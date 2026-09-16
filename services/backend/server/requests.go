package server

import (
	"errors"
	"io"
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
	if err := s.cfg.DB.Preload("User").Preload("Hospital").First(&doctor, "user_id = ?", claims.UserID).Error; err != nil {
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

	accident, err := s.openAccident(patient.ID)
	if err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not check for an open accident"})

		return
	}

	request := models.DocumentRequest{
		PatientID: patient.ID,
		DoctorID:  doctor.ID,
		Status:    models.RequestPending,
	}

	// A request made while an accident is open records which one, so that
	// dismissing the accident later takes back exactly the access it opened.
	if accident != nil {
		request.AccidentID = &accident.ID
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

	// The patient may be unconscious, so a confirmed accident diverts the
	// decision to the emergency contact. Failing to reach them must not fail
	// the request: the patient can still answer it from their own dashboard.
	if accident != nil {
		s.sendGrantRequest(c, &patient, &doctor, &request, accident)
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

const defaultGrantHours = 48

type approveRequestBody struct {
	ExpiresInHours *int `json:"expires_in_hours" binding:"omitempty,gte=1,lte=8760"`
}

// decideAccessRequest loads a request the caller is allowed to decide on. Only
// the patient the record belongs to may accept, decline or revoke.
func (s *Server) decideAccessRequest(c *gin.Context) (*models.DocumentRequest, *models.User, bool) {
	claims := claimsFrom(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
		return nil, nil, false
	}

	requestID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "request id must be a uuid"})
		return nil, nil, false
	}

	var request models.DocumentRequest
	if err := s.cfg.DB.First(&request, "id = ?", requestID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "request not found"})
			return nil, nil, false
		}

		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load the request"})

		return nil, nil, false
	}

	var patient models.Patient
	if err := s.cfg.DB.First(&patient, "id = ?", request.PatientID).Error; err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load patient"})

		return nil, nil, false
	}

	if patient.UserID != claims.UserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the patient can decide on this request"})
		return nil, nil, false
	}

	var user models.User
	if err := s.cfg.DB.First(&user, "id = ?", claims.UserID).Error; err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load your account"})

		return nil, nil, false
	}

	return &request, &user, true
}

func (s *Server) respondWithRequest(c *gin.Context, id uuid.UUID) {
	view, err := s.findRequestView(id)
	if err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load the request"})

		return
	}

	c.JSON(http.StatusOK, view)
}

func (s *Server) approveAccessRequest(c *gin.Context) {
	request, user, ok := s.decideAccessRequest(c)
	if !ok {
		return
	}

	if request.Status != models.RequestPending {
		c.JSON(http.StatusConflict, gin.H{
			"error": "only a pending request can be approved, this one is " + string(request.Status),
		})

		return
	}

	var body approveRequestBody
	if err := c.ShouldBindJSON(&body); err != nil && !errors.Is(err, io.EOF) {
		badRequest(c, err)
		return
	}

	hours := defaultGrantHours
	if body.ExpiresInHours != nil {
		hours = *body.ExpiresInHours
	}

	now := time.Now().UTC()
	expires := now.Add(time.Duration(hours) * time.Hour)

	updates := map[string]any{
		"status":           models.RequestGranted,
		"granted_by_email": user.Email,
		"granted_at":       now,
		"expires_at":       expires,
	}

	if err := s.cfg.DB.Model(&models.DocumentRequest{}).Where("id = ?", request.ID).Updates(updates).Error; err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not approve the request"})

		return
	}

	s.respondWithRequest(c, request.ID)
}

func (s *Server) declineAccessRequest(c *gin.Context) {
	request, _, ok := s.decideAccessRequest(c)
	if !ok {
		return
	}

	if request.Status != models.RequestPending {
		c.JSON(http.StatusConflict, gin.H{
			"error": "only a pending request can be declined, this one is " + string(request.Status),
		})

		return
	}

	if err := s.cfg.DB.Model(&models.DocumentRequest{}).
		Where("id = ?", request.ID).
		Update("status", models.RequestDeclined).Error; err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not decline the request"})

		return
	}

	s.respondWithRequest(c, request.ID)
}

func (s *Server) revokeAccessRequest(c *gin.Context) {
	request, _, ok := s.decideAccessRequest(c)
	if !ok {
		return
	}

	if request.Status != models.RequestGranted {
		c.JSON(http.StatusConflict, gin.H{
			"error": "only a granted request can be revoked, this one is " + string(request.Status),
		})

		return
	}

	// Access is resolved from this row on every read, so flipping the status is
	// enough: the doctor loses the chart on their very next request.
	if err := s.cfg.DB.Model(&models.DocumentRequest{}).
		Where("id = ?", request.ID).
		Update("status", models.RequestRevoked).Error; err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not revoke access"})

		return
	}

	s.respondWithRequest(c, request.ID)
}
