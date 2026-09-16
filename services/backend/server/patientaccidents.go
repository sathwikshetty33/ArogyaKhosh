package server

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/models"
)

type accidentGrant struct {
	RequestID  uuid.UUID            `json:"request_id"`
	DoctorName string               `json:"doctor_name"`
	Hospital   string               `json:"hospital"`
	Status     models.RequestStatus `json:"status"`
	GrantedAt  *time.Time           `json:"granted_at"`
}

type patientAccidentView struct {
	ID              uuid.UUID             `json:"id"`
	Status          models.AccidentStatus `json:"status"`
	Open            bool                  `json:"open"`
	ReportedAt      time.Time             `json:"reported_at"`
	NotifiedEmail   *string               `json:"notified_email"`
	NotifiedAt      *time.Time            `json:"notified_at"`
	DecidedAt       *time.Time            `json:"decided_at"`
	WindowExpiresAt *time.Time            `json:"window_expires_at"`
	ModelVerdict    *bool                 `json:"model_verdict"`
	Confidence      *float64              `json:"confidence"`
	Latitude        *float64              `json:"latitude"`
	Longitude       *float64              `json:"longitude"`
	PhotoURL        *string               `json:"photo_url,omitempty"`
	Grants          []accidentGrant       `json:"grants"`
}

// listPatientAccidents is owner-only. An accident is a stranger reporting on
// somebody's body and a third party being handed their records, so the person
// it happened to is the one who has to be able to see all of it.
func (s *Server) listPatientAccidents(c *gin.Context) {
	patient, ok := s.ownedPatient(c)
	if !ok {
		return
	}

	var accidents []models.Accident
	if err := s.cfg.DB.Where("patient_id = ?", patient.ID).
		Order("created_at DESC").Find(&accidents).Error; err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load accidents"})

		return
	}

	views := make([]patientAccidentView, 0, len(accidents))
	for i := range accidents {
		view, err := s.patientAccidentView(c, &accidents[i])
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load accidents"})

			return
		}

		views = append(views, view)
	}

	c.JSON(http.StatusOK, gin.H{"patient_id": patient.ID, "accidents": views})
}

// closeAccident is the patient taking the decision back. While an accident is
// open their emergency contact answers for them; closing it stops that, and
// every link already mailed out stops working on its next read.
func (s *Server) closeAccident(c *gin.Context) {
	claims := claimsFrom(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
		return
	}

	accidentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "accident id must be a uuid"})
		return
	}

	var accident models.Accident
	if err := s.cfg.DB.Preload("Patient").First(&accident, "id = ?", accidentID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "accident not found"})
			return
		}

		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load the accident"})

		return
	}

	if accident.Patient == nil || accident.Patient.UserID != claims.UserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the patient can close their own report"})
		return
	}

	if accident.Status != models.AccidentConfirmed {
		c.JSON(http.StatusConflict, gin.H{"error": "this report is not open"})
		return
	}

	now := time.Now()

	// Closing leaves the grants alone. A doctor already reading the chart is
	// treating the patient, and pulling it mid-treatment is not what 'stop
	// asking my contact' means; the patient can revoke each one by hand.
	updates := map[string]any{
		"status":     models.AccidentResolved,
		"decided_at": now,
		"expires_at": now,
	}

	if err := s.cfg.DB.Model(&models.Accident{}).Where("id = ?", accident.ID).Updates(updates).Error; err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not close the report"})

		return
	}

	accident.Status = models.AccidentResolved
	accident.DecidedAt = &now
	accident.ExpiresAt = &now

	view, err := s.patientAccidentView(c, &accident)
	if err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load the accident"})

		return
	}

	c.JSON(http.StatusOK, view)
}

func (s *Server) patientAccidentView(c *gin.Context, accident *models.Accident) (patientAccidentView, error) {
	view := patientAccidentView{
		ID:              accident.ID,
		Status:          accident.Status,
		Open:            accident.Status == models.AccidentConfirmed && !expired(accident.ExpiresAt),
		ReportedAt:      accident.CreatedAt,
		NotifiedEmail:   accident.NotifiedEmail,
		NotifiedAt:      accident.NotifiedAt,
		DecidedAt:       accident.DecidedAt,
		WindowExpiresAt: accident.ExpiresAt,
		ModelVerdict:    accident.ModelVerdict,
		Confidence:      accident.Confidence,
		Latitude:        accident.Latitude,
		Longitude:       accident.Longitude,
		Grants:          []accidentGrant{},
	}

	err := s.cfg.DB.
		Table("document_requests AS r").
		Select("r.id AS request_id, du.full_name AS doctor_name, h.name AS hospital, r.status, r.granted_at").
		Joins("JOIN doctors d ON d.id = r.doctor_id").
		Joins("JOIN users du ON du.id = d.user_id").
		Joins("JOIN hospitals h ON h.id = d.hospital_id").
		Where("r.accident_id = ?", accident.ID).
		Order("r.created_at DESC").
		Scan(&view.Grants).Error
	if err != nil {
		return view, err
	}

	if accident.PhotoKey != nil && s.cfg.Storage != nil {
		url, err := s.cfg.Storage.SignedURL(c.Request.Context(), *accident.PhotoKey, s.cfg.SignedURLTTL)
		if err != nil {
			c.Error(err)
		} else {
			view.PhotoURL = &url
		}
	}

	return view, nil
}

func (s *Server) ownedPatient(c *gin.Context) (*models.Patient, bool) {
	claims := claimsFrom(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
		return nil, false
	}

	patientID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "patient id must be a uuid"})
		return nil, false
	}

	var patient models.Patient
	if err := s.cfg.DB.First(&patient, "id = ?", patientID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "patient not found"})
			return nil, false
		}

		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load patient"})

		return nil, false
	}

	if patient.UserID != claims.UserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "this is not your record"})
		return nil, false
	}

	return &patient, true
}

func expired(at *time.Time) bool {
	return at != nil && time.Now().After(*at)
}
