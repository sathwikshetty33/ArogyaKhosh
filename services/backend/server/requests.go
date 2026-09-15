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

type requestView struct {
	ID     uuid.UUID            `json:"id"`
	Status models.RequestStatus `json:"status"`
	Active bool                 `json:"active"`

	PatientID   uuid.UUID `json:"patient_id"`
	PatientName string    `json:"patient_name"`

	DoctorID      uuid.UUID `json:"doctor_id"`
	DoctorName    string    `json:"doctor_name"`
	Hospital      string    `json:"hospital"`
	Qualification string    `json:"qualification"`
	Position      *string   `json:"position"`

	GrantedByEmail *string    `json:"granted_by_email"`
	GrantedAt      *time.Time `json:"granted_at"`
	ExpiresAt      *time.Time `json:"expires_at"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

const requestViewSelect = `r.id,
	r.status,
	(r.status = 'granted' AND (r.expires_at IS NULL OR r.expires_at > now())) AS active,
	r.patient_id,
	pu.full_name AS patient_name,
	r.doctor_id,
	du.full_name AS doctor_name,
	h.name AS hospital,
	d.qualification,
	d.position,
	r.granted_by_email,
	r.granted_at,
	r.expires_at,
	r.created_at,
	r.updated_at`

func (s *Server) requestQuery() *gorm.DB {
	return s.cfg.DB.
		Table("document_requests AS r").
		Select(requestViewSelect).
		Joins("JOIN doctors d ON d.id = r.doctor_id").
		Joins("JOIN users du ON du.id = d.user_id").
		Joins("JOIN hospitals h ON h.id = d.hospital_id").
		Joins("JOIN patients p ON p.id = r.patient_id").
		Joins("JOIN users pu ON pu.id = p.user_id")
}

func (s *Server) findRequestView(id uuid.UUID) (*requestView, error) {
	var view requestView
	if err := s.requestQuery().Where("r.id = ?", id).Scan(&view).Error; err != nil {
		return nil, err
	}

	if view.ID == uuid.Nil {
		return nil, gorm.ErrRecordNotFound
	}

	return &view, nil
}

func (s *Server) createAccessRequest(c *gin.Context) {
	claims := claimsFrom(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
		return
	}

	if claims.Role != models.RoleDoctor {
		c.JSON(http.StatusForbidden, gin.H{"error": "only a doctor can request access"})
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

	var doctor models.Doctor
	if err := s.cfg.DB.First(&doctor, "user_id = ?", claims.UserID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusForbidden, gin.H{"error": "your doctor profile is missing"})
			return
		}

		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load your profile"})

		return
	}

	var active int64
	if err := s.cfg.DB.Model(&models.DocumentRequest{}).
		Where("patient_id = ? AND doctor_id = ? AND status = ?", patient.ID, doctor.ID, models.RequestGranted).
		Where("expires_at IS NULL OR expires_at > now()").
		Count(&active).Error; err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not check existing access"})

		return
	}

	if active > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "you already have access to this patient"})
		return
	}

	request := models.DocumentRequest{
		PatientID: patient.ID,
		DoctorID:  doctor.ID,
		Status:    models.RequestPending,
	}

	if err := s.cfg.DB.Create(&request).Error; err != nil {
		if field := duplicateField(err); field != "" {
			c.JSON(http.StatusConflict, gin.H{"error": "you already have a pending request for this patient"})
			return
		}

		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create the request"})

		return
	}

	view, err := s.findRequestView(request.ID)
	if err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load the request"})

		return
	}

	c.JSON(http.StatusCreated, view)
}

type requestListResponse struct {
	PatientID uuid.UUID     `json:"patient_id"`
	Requests  []requestView `json:"requests"`
}

func (s *Server) listAccessRequests(c *gin.Context) {
	claims := claimsFrom(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
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

	// Who has asked for a chart, and who was turned down, is the patient's own
	// business. A doctor holding a grant does not get to see the others.
	if patient.UserID != claims.UserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the patient can see their access requests"})
		return
	}

	query := s.requestQuery().Where("r.patient_id = ?", patient.ID)

	if status := c.Query("status"); status != "" {
		switch models.RequestStatus(status) {
		case models.RequestPending, models.RequestGranted, models.RequestDeclined, models.RequestRevoked:
			query = query.Where("r.status = ?", status)
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "unknown status filter"})
			return
		}
	}

	requests := make([]requestView, 0)
	if err := query.Order("r.created_at DESC").Scan(&requests).Error; err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load access requests"})

		return
	}

	c.JSON(http.StatusOK, requestListResponse{PatientID: patient.ID, Requests: requests})
}
