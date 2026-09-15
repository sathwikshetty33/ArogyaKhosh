package server

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/authz"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/models"
)

type documentView struct {
	ID          uuid.UUID         `json:"id"`
	Name        string            `json:"name"`
	Visibility  models.Visibility `json:"visibility"`
	ContentType *string           `json:"content_type"`
	SizeBytes   *int64            `json:"size_bytes"`
	CreatedAt   time.Time         `json:"created_at"`
}

type patientView struct {
	ID       uuid.UUID `json:"id"`
	UserID   uuid.UUID `json:"user_id"`
	Username string    `json:"username"`
	FullName string    `json:"full_name"`

	Email                 *string  `json:"email,omitempty"`
	BloodGroup            *string  `json:"blood_group,omitempty"`
	HeightCm              *float64 `json:"height_cm,omitempty"`
	WeightKg              *float64 `json:"weight_kg,omitempty"`
	EmergencyContactEmail *string  `json:"emergency_contact_email,omitempty"`

	CreatedAt time.Time `json:"created_at"`
}

type grantView struct {
	ID             uuid.UUID  `json:"id"`
	DoctorName     string     `json:"doctor_name"`
	Hospital       string     `json:"hospital"`
	Qualification  string     `json:"qualification"`
	GrantedByEmail *string    `json:"granted_by_email"`
	GrantedAt      *time.Time `json:"granted_at"`
	ExpiresAt      *time.Time `json:"expires_at"`
}

type patientResponse struct {
	CurrentUserID uuid.UUID      `json:"current_user_id"`
	Access        authz.Level    `json:"access"`
	Patient       patientView    `json:"patient"`
	Documents     []documentView `json:"documents"`
	Grants        []grantView    `json:"grants,omitempty"`
}

func (s *Server) getPatient(c *gin.Context) {
	claims := claimsFrom(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil || id == uuid.Nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "patient id must be a uuid"})
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

	response := patientResponse{
		CurrentUserID: claims.UserID,
		Access:        level,
		Patient:       buildPatientView(&patient, level),
		Documents:     documents,
	}

	if level == authz.LevelOwner {
		grants, err := s.patientGrants(patient.ID)
		if err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load access grants"})

			return
		}

		response.Grants = grants
	}

	c.JSON(http.StatusOK, response)
}

func (s *Server) patientGrants(patientID uuid.UUID) ([]grantView, error) {
	grants := make([]grantView, 0)

	err := s.cfg.DB.
		Table("document_requests AS r").
		Select(`r.id,
		        u.full_name AS doctor_name,
		        h.name AS hospital,
		        d.qualification,
		        r.granted_by_email,
		        r.granted_at,
		        r.expires_at`).
		Joins("JOIN doctors d ON d.id = r.doctor_id").
		Joins("JOIN users u ON u.id = d.user_id").
		Joins("JOIN hospitals h ON h.id = d.hospital_id").
		Where("r.patient_id = ? AND r.status = ?", patientID, models.RequestGranted).
		Where("r.expires_at IS NULL OR r.expires_at > now()").
		Order("r.granted_at DESC").
		Scan(&grants).Error
	if err != nil {
		return nil, err
	}

	return grants, nil
}

func (s *Server) patientDocuments(patientID uuid.UUID, level authz.Level) ([]documentView, error) {
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

type updatePatientRequest struct {
	BloodGroup            *string  `json:"blood_group" binding:"omitempty,oneof=A+ A- B+ B- AB+ AB- O+ O-"`
	HeightCm              *float64 `json:"height_cm" binding:"omitempty,gt=0,lte=300"`
	WeightKg              *float64 `json:"weight_kg" binding:"omitempty,gt=0,lte=700"`
	EmergencyContactEmail *string  `json:"emergency_contact_email" binding:"omitempty,email,max=254"`
}

func (s *Server) updatePatient(c *gin.Context) {
	claims := claimsFrom(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "patient id must be a uuid"})
		return
	}

	var patient models.Patient
	if err := s.cfg.DB.Preload("User").First(&patient, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "patient not found"})
			return
		}

		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load patient"})

		return
	}

	if patient.UserID != claims.UserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the patient can change these details"})
		return
	}

	var req updatePatientRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err)
		return
	}

	// Only the keys actually present are touched, so a partial update cannot
	// silently blank a field the caller left out.
	updates := map[string]any{}

	if req.BloodGroup != nil {
		updates["blood_group"] = strings.TrimSpace(*req.BloodGroup)
	}

	if req.HeightCm != nil {
		updates["height_cm"] = *req.HeightCm
	}

	if req.WeightKg != nil {
		updates["weight_kg"] = *req.WeightKg
	}

	if req.EmergencyContactEmail != nil {
		updates["emergency_contact_email"] = normalizeOptionalEmail(req.EmergencyContactEmail)
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "nothing to update"})
		return
	}

	if err := s.cfg.DB.Model(&models.Patient{}).Where("id = ?", patient.ID).Updates(updates).Error; err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save the changes"})

		return
	}

	if err := s.cfg.DB.Preload("User").First(&patient, "id = ?", patient.ID).Error; err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not reload patient"})

		return
	}

	c.JSON(http.StatusOK, buildPatientView(&patient, authz.LevelOwner))
}
