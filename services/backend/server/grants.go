package server

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	utils "github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/auth"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/models"
)

type grantLinkView struct {
	RequestID         uuid.UUID            `json:"request_id"`
	Status            models.RequestStatus `json:"status"`
	PatientFirstName  string               `json:"patient_first_name"`
	DoctorName        string               `json:"doctor_name"`
	Hospital          string               `json:"hospital"`
	Qualification     string               `json:"qualification"`
	Position          *string              `json:"position"`
	RequestedAt       time.Time            `json:"requested_at"`
	AccessUntil       *time.Time           `json:"access_until,omitempty"`
	AccidentConfirmed bool                 `json:"accident_confirmed"`
}

type grantDecision struct {
	Decision string `json:"decision" binding:"required,oneof=grant deny"`
}

// viewGrant is what the emergency contact opens from the request mail. The
// token is the whole credential, so it shows who is asking and nothing of the
// records they are asking for.
func (s *Server) viewGrant(c *gin.Context) {
	request, accident, ok := s.grantByToken(c)
	if !ok {
		return
	}

	view, err := s.buildGrantLink(request, accident)
	if err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not open this link"})

		return
	}

	c.JSON(http.StatusOK, view)
}

func (s *Server) decideGrant(c *gin.Context) {
	var body grantDecision
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "decision must be grant or deny"})
		return
	}

	request, accident, ok := s.grantByToken(c)
	if !ok {
		return
	}

	// The token stays valid until it expires, so the row is what makes a
	// decision final. A request already settled cannot be reopened from an old
	// mail, which is what keeps a patient's revocation from being undone.
	if request.Status != models.RequestPending {
		c.JSON(http.StatusConflict, gin.H{"error": "this request has already been answered"})
		return
	}

	updates := map[string]any{"status": models.RequestDeclined}

	if body.Decision == "grant" {
		now := time.Now()
		updates["status"] = models.RequestGranted
		updates["granted_at"] = now
		updates["granted_by_email"] = accidentContact(accident)
		// Access opened by an accident dies with the accident. Nothing has to
		// remember to take it away.
		updates["expires_at"] = accident.ExpiresAt
	}

	err := s.cfg.DB.Model(&models.DocumentRequest{}).
		Where("id = ? AND status = ?", request.ID, models.RequestPending).
		Updates(updates).Error
	if err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not record the decision"})

		return
	}

	request.Status = updates["status"].(models.RequestStatus)

	view, err := s.buildGrantLink(request, accident)
	if err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load the request"})

		return
	}

	c.JSON(http.StatusOK, view)
}

// grantByToken authenticates the link before reading anything out of it, then
// checks the accident is still open. A signature alone is not authority: the
// window it was minted under has to still be running.
func (s *Server) grantByToken(c *gin.Context) (*models.DocumentRequest, *models.Accident, bool) {
	if s.cfg.GrantSigner == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "grant links are not available"})
		return nil, nil, false
	}

	claims, err := s.cfg.GrantSigner.Verify(c.Param("token"))
	if err != nil {
		if errors.Is(err, utils.ErrGrantTokenExpired) {
			c.JSON(http.StatusGone, gin.H{"error": "this link has expired"})
			return nil, nil, false
		}

		c.JSON(http.StatusNotFound, gin.H{"error": "this link is not valid"})

		return nil, nil, false
	}

	var request models.DocumentRequest

	err = s.cfg.DB.Preload("Patient.User").Preload("Doctor.User").Preload("Doctor.Hospital").
		First(&request, "id = ? AND accident_id = ?", claims.RequestID, claims.AccidentID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "this link is not valid"})
			return nil, nil, false
		}

		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not open this link"})

		return nil, nil, false
	}

	accident, err := s.openAccident(request.PatientID)
	if err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not open this link"})

		return nil, nil, false
	}

	if accident == nil || accident.ID != claims.AccidentID {
		c.JSON(http.StatusGone, gin.H{"error": "this report is no longer open"})
		return nil, nil, false
	}

	return &request, accident, true
}

func (s *Server) buildGrantLink(request *models.DocumentRequest, accident *models.Accident) (grantLinkView, error) {
	if request.Patient == nil || request.Doctor == nil ||
		request.Doctor.User == nil || request.Doctor.Hospital == nil {
		return grantLinkView{}, fmt.Errorf("request %s is missing its patient or doctor", request.ID)
	}

	return grantLinkView{
		RequestID:         request.ID,
		Status:            request.Status,
		PatientFirstName:  firstName(*request.Patient),
		DoctorName:        request.Doctor.User.FullName,
		Hospital:          request.Doctor.Hospital.Name,
		Qualification:     request.Doctor.Qualification,
		Position:          request.Doctor.Position,
		RequestedAt:       request.CreatedAt,
		AccessUntil:       accident.ExpiresAt,
		AccidentConfirmed: accident.Status == models.AccidentConfirmed,
	}, nil
}
