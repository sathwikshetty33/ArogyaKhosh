package server

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	utils "github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/auth"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/mailer"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/mailq"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/models"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/storage"
)

const (
	// A public endpoint that sends mail needs a ceiling, or one scanned card
	// becomes a way to flood somebody's inbox.
	accidentRateLimit  = 3
	accidentRateWindow = time.Hour

	// How long a confirmed accident keeps authorising grants. A trauma
	// admission outlasts a shift, so this is days; it is not indefinite,
	// because nobody remembers to close these.
	accidentWindow = 7 * 24 * time.Hour

	// An unconfirmed report authorises too, but on a stranger's word alone,
	// so it gets the shorter leash. It is the same day the approval link
	// lives: past that, a report nobody vouched for stops carrying weight.
	accidentReportWindow = 24 * time.Hour
)

var photoTypeAllowed = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
}

type accidentResponse struct {
	ID               uuid.UUID             `json:"id"`
	Status           models.AccidentStatus `json:"status"`
	PatientFirstName string                `json:"patient_first_name"`
	PhotoScored      bool                  `json:"photo_scored"`
	ContactNotified  bool                  `json:"contact_notified"`
}

// reportAccident is deliberately unauthenticated: the person scanning the card
// is a stranger holding somebody else's phone. Nothing about the patient beyond
// a first name comes back, and the response never reveals what the model
// thought, so a photo cannot be tuned against it.
func (s *Server) reportAccident(c *gin.Context) {
	patientID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "patient id must be a uuid"})
		return
	}

	var patient models.Patient
	if err := s.cfg.DB.Preload("User").First(&patient, "id = ?", patientID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "this card is not registered"})
			return
		}

		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not read the card"})

		return
	}

	if s.accidentRateLimited(c, patient.ID) {
		return
	}

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadBytes)

	photo, contentType, err := s.readAccidentPhoto(c)
	if err != nil {
		return
	}

	reportWindow := time.Now().Add(accidentReportWindow)

	accident := models.Accident{
		PatientID:  patient.ID,
		Status:     models.AccidentReported,
		ExpiresAt:  &reportWindow,
		ReporterIP: optional(c.ClientIP()),
		Latitude:   optionalFloat(c.PostForm("latitude")),
		Longitude:  optionalFloat(c.PostForm("longitude")),
	}

	if len(photo) > 0 {
		s.scoreAccidentPhoto(c, &accident, photo, contentType)
		s.storeAccidentPhoto(c, &accident, patient.ID, photo, contentType)
	}

	rawKey, keyHash, err := utils.NewApprovalKey()
	if err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not raise the alert"})

		return
	}

	expires := time.Now().Add(utils.ApprovalKeyTTL)
	accident.ApprovalKeyHash = &keyHash
	accident.ApprovalKeyExpiresAt = &expires

	if err := s.cfg.DB.Create(&accident).Error; err != nil {
		c.Error(err)

		if accident.PhotoKey != nil && s.cfg.Storage != nil {
			if cleanup := s.cfg.Storage.Delete(c.Request.Context(), *accident.PhotoKey); cleanup != nil {
				c.Error(fmt.Errorf("orphaned accident photo %s: %w", *accident.PhotoKey, cleanup))
			}
		}

		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not raise the alert"})

		return
	}

	notified := s.notifyEmergencyContact(c, &patient, &accident, rawKey)

	c.JSON(http.StatusCreated, accidentResponse{
		ID:               accident.ID,
		Status:           accident.Status,
		PatientFirstName: firstName(patient),
		PhotoScored:      accident.ModelVerdict != nil,
		ContactNotified:  notified,
	})
}

func (s *Server) accidentRateLimited(c *gin.Context, patientID uuid.UUID) bool {
	var recent int64

	err := s.cfg.DB.Model(&models.Accident{}).
		Where("patient_id = ? AND created_at > ?", patientID, time.Now().Add(-accidentRateWindow)).
		Count(&recent).Error
	if err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not raise the alert"})

		return true
	}

	if recent >= accidentRateLimit {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error": "this card has already been reported recently; their contact has been told",
		})

		return true
	}

	return false
}

// readAccidentPhoto returns nil bytes when no photo was sent. That is a
// supported path: a pedestrian struck by a car that drove off leaves nothing
// for the model to look at, and the alert still has to go out.
func (s *Server) readAccidentPhoto(c *gin.Context) ([]byte, string, error) {
	header, err := c.FormFile("photo")
	if err != nil {
		if errors.Is(err, http.ErrMissingFile) {
			return nil, "", nil
		}

		c.Error(err)
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{
			"error": fmt.Sprintf("the photo must be %d MB or smaller", maxUploadBytes>>20),
		})

		return nil, "", err
	}

	file, err := header.Open()
	if err != nil {
		c.Error(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "could not read the photo"})

		return nil, "", err
	}
	defer file.Close()

	photo, err := io.ReadAll(io.LimitReader(file, maxUploadBytes))
	if err != nil {
		c.Error(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "could not read the photo"})

		return nil, "", err
	}

	contentType := strings.TrimSpace(strings.SplitN(http.DetectContentType(photo), ";", 2)[0])
	if !photoTypeAllowed[contentType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "the photo must be a jpeg, png or webp image"})

		return nil, "", errors.New("unsupported photo type")
	}

	return photo, contentType, nil
}

// scoreAccidentPhoto records what the model thought. A failure here is never
// fatal: the contact still gets told, with the report marked unscored.
func (s *Server) scoreAccidentPhoto(c *gin.Context, accident *models.Accident, photo []byte, contentType string) {
	if s.cfg.AI == nil {
		return
	}

	verdict, err := s.cfg.AI.VerifyAccident(c.Request.Context(), photo, contentType)
	if err != nil {
		// The model is a prioritiser, not a gate. If it is down or it refuses
		// the image, the report still stands and the contact is still told.
		c.Error(fmt.Errorf("scoring photo: %w", err))
		return
	}

	accident.ModelName = optional(verdict.ModelName)
	accident.Confidence = &verdict.Confidence
	accident.ModelThreshold = &verdict.Threshold
	accident.ModelVerdict = &verdict.IsAccident
}

func (s *Server) storeAccidentPhoto(c *gin.Context, accident *models.Accident, patientID uuid.UUID, photo []byte, contentType string) {
	if s.cfg.Storage == nil {
		return
	}

	key := storage.NewKey("accidents/"+patientID.String(), "scene"+extensionFor(contentType))

	err := s.cfg.Storage.Upload(c.Request.Context(), storage.Object{
		Key:         key,
		Body:        bytes.NewReader(photo),
		ContentType: contentType,
		Size:        int64(len(photo)),
	})
	if err != nil {
		c.Error(fmt.Errorf("storing accident photo: %w", err))
		return
	}

	size := int64(len(photo))
	accident.PhotoKey = &key
	accident.PhotoContentType = &contentType
	accident.PhotoSizeBytes = &size
}

func (s *Server) notifyEmergencyContact(c *gin.Context, patient *models.Patient, accident *models.Accident, rawKey string) bool {
	if patient.EmergencyContactEmail == nil || *patient.EmergencyContactEmail == "" {
		return false
	}

	to := *patient.EmergencyContactEmail
	link := fmt.Sprintf("%s/accept/%s/%s", s.cfg.AppBaseURL, accident.ID, rawKey)

	message := mailer.Message{
		To:      []string{to},
		Subject: fmt.Sprintf("%s may have been in an accident", fullName(*patient)),
		Text:    accidentAlertText(*patient, *accident, link),
		HTML:    accidentAlertHTML(*patient, *accident, link),
	}

	if err := s.dispatch(c.Request.Context(), mailq.KindAccidentAlert, accident.ID, message); err != nil {
		c.Error(fmt.Errorf("alerting %s: %w", to, err))
		return false
	}

	now := time.Now()

	if err := s.cfg.DB.Model(&models.Accident{}).Where("id = ?", accident.ID).
		Update("alert_queued_at", now).Error; err != nil {
		c.Error(err)
	}

	accident.AlertQueuedAt = &now

	return true
}

func MarkAlerted(db *gorm.DB, accidentID uuid.UUID, recipient string) error {
	now := time.Now()

	return db.Model(&models.Accident{}).
		Where("id = ? AND status = ?", accidentID, models.AccidentReported).
		Updates(map[string]any{
			"status":         models.AccidentNotified,
			"notified_at":    now,
			"notified_email": recipient,
		}).Error
}

func accidentAlertText(patient models.Patient, accident models.Accident, link string) string {
	var body strings.Builder

	fmt.Fprintf(&body, "Someone scanned %s's ArogyaKhosh emergency card.\n\n", fullName(patient))
	body.WriteString(verdictLine(accident) + "\n\n")
	body.WriteString("You are listed as their emergency contact. If this looks real, open\n")
	body.WriteString("the link below to let a treating doctor read their records:\n\n")
	body.WriteString(link + "\n\n")
	body.WriteString("The link stops working in 24 hours. Nothing is shared until you use it.\n")
	body.WriteString("If you know they are safe, you can ignore this message.\n")

	return body.String()
}

func accidentAlertHTML(patient models.Patient, accident models.Accident, link string) string {
	return fmt.Sprintf(`<p>Someone scanned <strong>%s</strong>'s ArogyaKhosh emergency card.</p>
<p>%s</p>
<p>You are listed as their emergency contact. If this looks real, open the link below
to let a treating doctor read their records:</p>
<p><a href="%s">Review this report</a></p>
<p>The link stops working in 24 hours. Nothing is shared until you use it.
If you know they are safe, you can ignore this message.</p>`,
		fullName(patient), verdictLine(accident), link)
}

func verdictLine(accident models.Accident) string {
	switch {
	case accident.ModelVerdict == nil && accident.PhotoKey == nil:
		return "No photo was sent, so we could not check the scene."
	case accident.ModelVerdict == nil:
		return "A photo was sent, but we could not check it."
	case *accident.ModelVerdict:
		return "A photo was sent and appears to show a damaged vehicle."
	default:
		return "A photo was sent, but it does not clearly show an accident."
	}
}

func fullName(patient models.Patient) string {
	if patient.User != nil {
		return patient.User.FullName
	}

	return "A patient"
}

func firstName(patient models.Patient) string {
	name := fullName(patient)
	if first, _, found := strings.Cut(name, " "); found {
		return first
	}

	return name
}

func extensionFor(contentType string) string {
	switch contentType {
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	default:
		return ".jpg"
	}
}

func optional(value string) *string {
	if strings.TrimSpace(value) == "" {
		return nil
	}

	return &value
}

func optionalFloat(raw string) *float64 {
	value, err := strconv.ParseFloat(strings.TrimSpace(raw), 64)
	if err != nil {
		return nil
	}

	return &value
}
