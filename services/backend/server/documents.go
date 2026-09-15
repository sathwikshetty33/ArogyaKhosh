package server

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/authz"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/models"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/storage"
)

const (
	maxUploadBytes = 20 << 20
	sniffBytes     = 512
)

var sniffedTypeAllowed = map[string]bool{
	"application/pdf": true,
	"image/png":       true,
	"image/jpeg":      true,
	"image/webp":      true,
	"text/plain":      true,
	"application/zip": true,
}

func (s *Server) uploadDocument(c *gin.Context) {
	claims := claimsFrom(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
		return
	}

	if s.cfg.Storage == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "document storage is not configured"})
		return
	}

	patientID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "patient id must be a uuid"})
		return
	}

	var patient models.Patient
	if err := s.cfg.DB.First(&patient, "id = ?", patientID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "patient not found"})
			return
		}

		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load patient"})

		return
	}

	level, err := authz.PatientAccess(s.cfg.DB, claims.UserID, claims.Role, &patient)
	if err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not resolve access"})

		return
	}

	if level != authz.LevelOwner {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the patient can add records"})
		return
	}

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadBytes)

	header, err := c.FormFile("file")
	if err != nil {
		if errors.Is(err, http.ErrMissingFile) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "a file is required"})
			return
		}

		c.Error(err)
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{
			"error": fmt.Sprintf("the file must be %d MB or smaller", maxUploadBytes>>20),
		})

		return
	}

	if header.Size == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "the file is empty"})
		return
	}

	if !storage.ExtensionAllowed(header.Filename) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "unsupported file type, allowed: " + strings.Join(storage.AllowedExtensions(), ", "),
		})

		return
	}

	visibility := models.Visibility(strings.TrimSpace(c.PostForm("visibility")))
	if visibility == "" {
		visibility = models.VisibilityPrivate
	}

	if visibility != models.VisibilityPrivate && visibility != models.VisibilityPublic {
		c.JSON(http.StatusBadRequest, gin.H{"error": "visibility must be public or private"})
		return
	}

	file, err := header.Open()
	if err != nil {
		c.Error(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "could not read the uploaded file"})

		return
	}
	defer file.Close()

	head := make([]byte, sniffBytes)
	read, err := io.ReadFull(file, head)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) && !errors.Is(err, io.EOF) {
		c.Error(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "could not read the uploaded file"})

		return
	}

	head = head[:read]

	contentType := strings.TrimSpace(strings.SplitN(http.DetectContentType(head), ";", 2)[0])
	if !sniffedTypeAllowed[contentType] {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "the file contents do not match a supported document type",
		})

		return
	}

	name := strings.TrimSpace(c.PostForm("name"))
	if name == "" {
		name = strings.TrimSpace(path.Base(header.Filename))
	}

	if len(name) > 200 {
		name = name[:200]
	}

	key := storage.NewKey("patients/"+patient.ID.String(), header.Filename)

	err = s.cfg.Storage.Upload(c.Request.Context(), storage.Object{
		Key:         key,
		Body:        io.MultiReader(bytes.NewReader(head), file),
		ContentType: contentType,
		Size:        header.Size,
	})
	if err != nil {
		c.Error(err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "could not store the file"})

		return
	}

	size := header.Size
	document := models.PatientDocument{
		PatientID:   patient.ID,
		Name:        name,
		StorageKey:  key,
		Visibility:  visibility,
		ContentType: &contentType,
		SizeBytes:   &size,
	}

	if err := s.cfg.DB.Create(&document).Error; err != nil {
		c.Error(err)

		// The bytes landed but the row did not, so remove the orphan.
		if cleanup := s.cfg.Storage.Delete(c.Request.Context(), key); cleanup != nil {
			c.Error(fmt.Errorf("orphaned object %s: %w", key, cleanup))
		}

		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save the record"})

		return
	}

	c.JSON(http.StatusCreated, documentView{
		ID:          document.ID,
		Name:        document.Name,
		Visibility:  document.Visibility,
		ContentType: document.ContentType,
		SizeBytes:   document.SizeBytes,
		CreatedAt:   document.CreatedAt,
	})
}

type signedURLResponse struct {
	URL       string       `json:"url"`
	ExpiresIn int64        `json:"expires_in"`
	ExpiresAt time.Time    `json:"expires_at"`
	Document  documentView `json:"document"`
}

// documentForAccess loads a document together with the caller's access level for
// the patient it belongs to. It writes a response and returns false when the
// caller may not touch the document at all.
func (s *Server) documentForAccess(c *gin.Context) (*models.PatientDocument, authz.Level, bool) {
	claims := claimsFrom(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
		return nil, authz.LevelDenied, false
	}

	documentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "document id must be a uuid"})
		return nil, authz.LevelDenied, false
	}

	var document models.PatientDocument
	if err := s.cfg.DB.First(&document, "id = ?", documentID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
			return nil, authz.LevelDenied, false
		}

		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load document"})

		return nil, authz.LevelDenied, false
	}

	var patient models.Patient
	if err := s.cfg.DB.First(&patient, "id = ?", document.PatientID).Error; err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load patient"})

		return nil, authz.LevelDenied, false
	}

	level, err := authz.PatientAccess(s.cfg.DB, claims.UserID, claims.Role, &patient)
	if err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not resolve access"})

		return nil, authz.LevelDenied, false
	}

	if level == authz.LevelDenied {
		c.JSON(http.StatusForbidden, gin.H{"error": "you do not have access to this document"})
		return nil, authz.LevelDenied, false
	}

	return &document, level, true
}

func (s *Server) documentURL(c *gin.Context) {
	if s.cfg.Storage == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "document storage is not configured"})
		return
	}

	document, level, ok := s.documentForAccess(c)
	if !ok {
		return
	}

	// A patient-level grant covers every document; without one only the
	// documents the patient marked public may be opened.
	if !level.CanReadAll() && document.Visibility != models.VisibilityPublic {
		c.JSON(http.StatusForbidden, gin.H{"error": "this document is private"})
		return
	}

	ttl := s.cfg.SignedURLTTL
	if ttl <= 0 {
		ttl = time.Minute
	}

	url, err := s.cfg.Storage.SignedURL(c.Request.Context(), document.StorageKey, ttl)
	if err != nil {
		c.Error(err)

		if errors.Is(err, storage.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "the stored file is missing"})
			return
		}

		c.JSON(http.StatusBadGateway, gin.H{"error": "could not create a download link"})

		return
	}

	c.JSON(http.StatusOK, signedURLResponse{
		URL:       url,
		ExpiresIn: int64(ttl.Seconds()),
		ExpiresAt: time.Now().Add(ttl).UTC(),
		Document: documentView{
			ID:          document.ID,
			Name:        document.Name,
			Visibility:  document.Visibility,
			ContentType: document.ContentType,
			SizeBytes:   document.SizeBytes,
			CreatedAt:   document.CreatedAt,
		},
	})
}

func (s *Server) deleteDocument(c *gin.Context) {
	document, level, ok := s.documentForAccess(c)
	if !ok {
		return
	}

	if level != authz.LevelOwner {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the patient can delete records"})
		return
	}

	if err := s.cfg.DB.Delete(&models.PatientDocument{}, "id = ?", document.ID).Error; err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete the record"})

		return
	}

	// The row is gone, so the document has left the patient's view either way.
	// A failure here leaves unreferenced bytes behind rather than a broken row.
	if s.cfg.Storage != nil {
		if err := s.cfg.Storage.Delete(c.Request.Context(), document.StorageKey); err != nil {
			if !errors.Is(err, storage.ErrNotFound) {
				c.Error(fmt.Errorf("orphaned object %s: %w", document.StorageKey, err))
			}
		}
	}

	c.Status(http.StatusNoContent)
}
