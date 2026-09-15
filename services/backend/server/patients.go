package server

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/authz"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/models"
)

type documentView struct {
	ID          int64             `json:"id"`
	Name        string            `json:"name"`
	Visibility  models.Visibility `json:"visibility"`
	ContentType *string           `json:"content_type"`
	SizeBytes   *int64            `json:"size_bytes"`
	CreatedAt   time.Time         `json:"created_at"`
}

type patientView struct {
	ID       int64  `json:"id"`
	UserID   int64  `json:"user_id"`
	Username string `json:"username"`
	FullName string `json:"full_name"`

	Email                 *string  `json:"email,omitempty"`
	BloodGroup            *string  `json:"blood_group,omitempty"`
	HeightCm              *float64 `json:"height_cm,omitempty"`
	WeightKg              *float64 `json:"weight_kg,omitempty"`
	EmergencyContactEmail *string  `json:"emergency_contact_email,omitempty"`

	CreatedAt time.Time `json:"created_at"`
}

type patientResponse struct {
	CurrentUserID int64          `json:"current_user_id"`
	Access        authz.Level    `json:"access"`
	Patient       patientView    `json:"patient"`
	Documents     []documentView `json:"documents"`
}

func (s *Server) getPatient(c *gin.Context) {
	claims := claimsFrom(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
		return
	}

	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "patient id must be a positive integer"})
		return
	}

	var patient models.Patient
	if err := s.cfg.DB.Preload("User").First(&patient, id).Error; err != nil {
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

	if level == authz.LevelDenied {
		c.JSON(http.StatusForbidden, gin.H{"error": "you do not have access to this patient"})
		return
	}

	documents, err := s.patientDocuments(patient.ID, level)
	if err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load documents"})

		return
	}

	c.JSON(http.StatusOK, patientResponse{
		CurrentUserID: claims.UserID,
		Access:        level,
		Patient:       buildPatientView(&patient, level),
		Documents:     documents,
	})
}

func (s *Server) patientDocuments(patientID int64, level authz.Level) ([]documentView, error) {
	query := s.cfg.DB.
		Model(&models.PatientDocument{}).
		Where("patient_id = ?", patientID).
		Order("created_at DESC")

	if !level.CanReadAll() {
		query = query.Where("visibility = ?", models.VisibilityPublic)
	}

	var records []models.PatientDocument
	if err := query.Find(&records).Error; err != nil {
		return nil, err
	}

	documents := make([]documentView, 0, len(records))
	for _, record := range records {
		documents = append(documents, documentView{
			ID:          record.ID,
			Name:        record.Name,
			Visibility:  record.Visibility,
			ContentType: record.ContentType,
			SizeBytes:   record.SizeBytes,
			CreatedAt:   record.CreatedAt,
		})
	}

	return documents, nil
}

func buildPatientView(patient *models.Patient, level authz.Level) patientView {
	view := patientView{
		ID:        patient.ID,
		UserID:    patient.UserID,
		CreatedAt: patient.CreatedAt,
	}

	if patient.User != nil {
		view.Username = patient.User.Username
		view.FullName = patient.User.FullName
	}

	if !level.CanReadAll() {
		return view
	}

	if patient.User != nil {
		email := patient.User.Email
		view.Email = &email
	}

	view.BloodGroup = patient.BloodGroup
	view.HeightCm = patient.HeightCm
	view.WeightKg = patient.WeightKg
	view.EmergencyContactEmail = patient.EmergencyContactEmail

	return view
}
