package server

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/models"
)

const minSearchLength = 3

type patientSearchResult struct {
	ID       uuid.UUID `json:"id"`
	FullName string    `json:"full_name"`
	Username string    `json:"username"`

	Status *models.RequestStatus `json:"request_status"`
	Active bool                  `json:"active"`
}

// searchPatients resolves a patient from an identifier the doctor already
// holds. It deliberately matches an exact username or email rather than a
// partial name: a fuzzy search would let any doctor walk the patient directory.
func (s *Server) searchPatients(c *gin.Context) {
	claims := claimsFrom(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
		return
	}

	if claims.Role != models.RoleDoctor {
		c.JSON(http.StatusForbidden, gin.H{"error": "only a doctor can look up patients"})
		return
	}

	query := strings.ToLower(strings.TrimSpace(c.Query("q")))
	if len(query) < minSearchLength {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "enter the patient's full username or email",
		})

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

	results := make([]patientSearchResult, 0, 1)

	err := s.cfg.DB.
		Table("patients AS p").
		Select(`p.id,
			u.full_name,
			u.username,
			r.status,
			(r.status = 'granted' AND (r.expires_at IS NULL OR r.expires_at > now())) AS active`).
		Joins("JOIN users u ON u.id = p.user_id").
		Joins(`LEFT JOIN document_requests r
			ON r.patient_id = p.id
			AND r.doctor_id = ?
			AND r.status IN ('pending', 'granted')`, doctor.ID).
		Where("lower(u.username) = ? OR lower(u.email) = ?", query, query).
		Limit(5).
		Scan(&results).Error
	if err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not search"})

		return
	}

	c.JSON(http.StatusOK, gin.H{"results": results})
}

// doctorSelf loads the doctor profile the caller owns.
func (s *Server) doctorSelf(c *gin.Context) (*models.Doctor, bool) {
	claims := claimsFrom(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
		return nil, false
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "doctor id must be a uuid"})
		return nil, false
	}

	var doctor models.Doctor
	if err := s.cfg.DB.First(&doctor, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "doctor not found"})
			return nil, false
		}

		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load doctor"})

		return nil, false
	}

	if doctor.UserID != claims.UserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "you can only manage your own profile"})
		return nil, false
	}

	return &doctor, true
}

func (s *Server) listDoctorRequests(c *gin.Context) {
	doctor, ok := s.doctorSelf(c)
	if !ok {
		return
	}

	requests := make([]requestView, 0)

	err := s.requestQuery().
		Where("r.doctor_id = ?", doctor.ID).
		Order("r.created_at DESC").
		Scan(&requests).Error
	if err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load your requests"})

		return
	}

	c.JSON(http.StatusOK, gin.H{"doctor_id": doctor.ID, "requests": requests})
}

type updateDoctorRequest struct {
	Qualification *string `json:"qualification" binding:"omitempty,min=1,max=200"`
	Position      *string `json:"position" binding:"omitempty,max=200"`
	HospitalID    *string `json:"hospital_id" binding:"omitempty,uuid"`
}

func (s *Server) updateDoctor(c *gin.Context) {
	doctor, ok := s.doctorSelf(c)
	if !ok {
		return
	}

	var req updateDoctorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err)
		return
	}

	updates := map[string]any{}

	if req.Qualification != nil {
		qualification := strings.TrimSpace(*req.Qualification)
		if qualification == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "qualification must not be blank"})
			return
		}

		updates["qualification"] = qualification
	}

	if req.Position != nil {
		updates["position"] = trimOptional(req.Position)
	}

	if req.HospitalID != nil {
		hospitalID, err := uuid.Parse(*req.HospitalID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "hospital_id must be a uuid"})
			return
		}

		var count int64
		if err := s.cfg.DB.Model(&models.Hospital{}).Where("id = ?", hospitalID).Count(&count).Error; err != nil {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not check the hospital"})

			return
		}

		if count == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "hospital not found"})
			return
		}

		updates["hospital_id"] = hospitalID
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "nothing to update"})
		return
	}

	if err := s.cfg.DB.Model(&models.Doctor{}).Where("id = ?", doctor.ID).Updates(updates).Error; err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save the changes"})

		return
	}

	var updated models.Doctor
	if err := s.cfg.DB.Preload("Hospital").First(&updated, "id = ?", doctor.ID).Error; err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not reload your profile"})

		return
	}

	updated.User = nil

	c.JSON(http.StatusOK, updated)
}

func (s *Server) listHospitals(c *gin.Context) {
	var hospitals []models.Hospital
	if err := s.cfg.DB.Order("name").Limit(200).Find(&hospitals).Error; err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load hospitals"})

		return
	}

	c.JSON(http.StatusOK, gin.H{"hospitals": hospitals})
}
