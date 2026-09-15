package server

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	utils "github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/auth"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/models"
)

type approvalView struct {
	ID               uuid.UUID             `json:"id"`
	Status           models.AccidentStatus `json:"status"`
	PatientFirstName string                `json:"patient_first_name"`
	ReportedAt       time.Time             `json:"reported_at"`
	PhotoURL         *string               `json:"photo_url,omitempty"`
	ModelVerdict     *bool                 `json:"model_verdict,omitempty"`
	Latitude         *float64              `json:"latitude,omitempty"`
	Longitude        *float64              `json:"longitude,omitempty"`
	DecidedAt        *time.Time            `json:"decided_at,omitempty"`
	ExpiresAt        *time.Time            `json:"expires_at,omitempty"`
}

type approvalDecision struct {
	Decision string `json:"decision" binding:"required,oneof=confirm dismiss"`
}

// viewApproval is what the emergency contact opens from the alert mail. The
// key in the URL is the only credential, so it buys sight of one accident and
// nothing else: no documents, no other reports, not even a full name.
func (s *Server) viewApproval(c *gin.Context) {
	accident, ok := s.accidentByKey(c)
	if !ok {
		return
	}

	c.JSON(http.StatusOK, s.approvalView(c, accident))
}

// decideApproval is the first approval in the flow. Confirming opens the
// window in which a doctor may ask for the patient's records; it does not hand
// anything over by itself.
func (s *Server) decideApproval(c *gin.Context) {
	var body approvalDecision
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "decision must be confirm or dismiss"})
		return
	}

	accident, ok := s.accidentByKey(c)
	if !ok {
		return
	}

	if accident.Status == models.AccidentResolved {
		c.JSON(http.StatusConflict, gin.H{"error": "this report has already been closed"})
		return
	}

	status := models.AccidentConfirmed
	if body.Decision == "dismiss" {
		status = models.AccidentDismissed
	}

	now := time.Now()
	updates := map[string]any{
		"status":        status,
		"decided_at":    now,
		"decided_email": accidentContact(accident),
	}

	// The first decision is recorded, but the link keeps working until it
	// expires: a contact who confirms and then learns it was a false alarm has
	// to be able to take it back.
	if accident.ApprovalUsedAt == nil {
		updates["approval_used_at"] = now
	}

	if err := s.cfg.DB.Model(&models.Accident{}).Where("id = ?", accident.ID).Updates(updates).Error; err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not record the decision"})

		return
	}

	accident.Status = status
	accident.DecidedAt = &now

	if status == models.AccidentDismissed {
		s.revokeAccidentGrants(c, accident)
	}

	c.JSON(http.StatusOK, s.approvalView(c, accident))
}

// accidentByKey resolves the accident the emailed key belongs to. It looks the
// row up by the hash rather than by the id in the path, so a wrong key cannot
// be used to probe which accident ids exist.
func (s *Server) accidentByKey(c *gin.Context) (*models.Accident, bool) {
	accidentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "this link is not valid"})
		return nil, false
	}

	raw := c.Param("key")
	if err := utils.ValidApprovalKey(raw); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "this link is not valid"})
		return nil, false
	}

	var accident models.Accident

	err = s.cfg.DB.Preload("Patient.User").
		First(&accident, "id = ? AND approval_key_hash = ?", accidentID, utils.HashApprovalKey(raw)).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "this link is not valid"})
			return nil, false
		}

		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not open this link"})

		return nil, false
	}

	if accident.ApprovalKeyExpiresAt == nil || time.Now().After(*accident.ApprovalKeyExpiresAt) {
		c.JSON(http.StatusGone, gin.H{"error": "this link has expired"})
		return nil, false
	}

	return &accident, true
}

func (s *Server) approvalView(c *gin.Context, accident *models.Accident) approvalView {
	view := approvalView{
		ID:           accident.ID,
		Status:       accident.Status,
		ReportedAt:   accident.CreatedAt,
		ModelVerdict: accident.ModelVerdict,
		Latitude:     accident.Latitude,
		Longitude:    accident.Longitude,
		DecidedAt:    accident.DecidedAt,
		ExpiresAt:    accident.ApprovalKeyExpiresAt,
	}

	if accident.Patient != nil {
		view.PatientFirstName = firstName(*accident.Patient)
	}

	// The photo is the whole basis of the decision, so the contact has to be
	// able to see it. It is a street, not a record: the signed URL is short
	// lived and the key behind it never leaves the server.
	if accident.PhotoKey != nil && s.cfg.Storage != nil {
		url, err := s.cfg.Storage.SignedURL(c.Request.Context(), *accident.PhotoKey, s.cfg.SignedURLTTL)
		if err != nil {
			c.Error(err)
		} else {
			view.PhotoURL = &url
		}
	}

	return view
}

// revokeAccidentGrants withdraws everything this accident opened up. A contact
// who says it was a false alarm expects the doctors to lose the chart, not
// just to stop receiving mail.
func (s *Server) revokeAccidentGrants(c *gin.Context, accident *models.Accident) {
	err := s.cfg.DB.Model(&models.DocumentRequest{}).
		Where("patient_id = ? AND status = ? AND granted_at >= ?",
			accident.PatientID, models.RequestGranted, accident.CreatedAt).
		Update("status", models.RequestRevoked).Error
	if err != nil {
		c.Error(err)
	}
}

func accidentContact(accident *models.Accident) string {
	if accident.NotifiedEmail != nil {
		return *accident.NotifiedEmail
	}

	if accident.Patient != nil && accident.Patient.EmergencyContactEmail != nil {
		return *accident.Patient.EmergencyContactEmail
	}

	return "unknown"
}
