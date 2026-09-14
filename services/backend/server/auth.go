package server

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"

	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/auth"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/models"
)

const uniqueViolationCode = "23505"

type registerPatientRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50,alphanum"`
	FullName string `json:"full_name" binding:"required,min=1,max=200"`
	Email    string `json:"email" binding:"required,email,max=254"`
	Password string `json:"password" binding:"required,min=8,max=72"`

	BloodGroup            *string  `json:"blood_group" binding:"omitempty,oneof=A+ A- B+ B- AB+ AB- O+ O-"`
	HeightCm              *float64 `json:"height_cm" binding:"omitempty,gt=0,lte=300"`
	WeightKg              *float64 `json:"weight_kg" binding:"omitempty,gt=0,lte=700"`
	EmergencyContactEmail *string  `json:"emergency_contact_email" binding:"omitempty,email,max=254"`
}

type registerDoctorRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50,alphanum"`
	FullName string `json:"full_name" binding:"required,min=1,max=200"`
	Email    string `json:"email" binding:"required,email,max=254"`
	Password string `json:"password" binding:"required,min=8,max=72"`

	HospitalID    int64   `json:"hospital_id" binding:"required,gt=0"`
	Qualification string  `json:"qualification" binding:"required,min=1,max=200"`
	Position      *string `json:"position" binding:"omitempty,max=200"`
}

type authResponse struct {
	Token     string       `json:"token"`
	ExpiresIn int64        `json:"expires_in"`
	User      *models.User `json:"user"`
	Profile   any          `json:"profile"`
}

func (s *Server) registerPatient(c *gin.Context) {
	var req registerPatientRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err)
		return
	}

	user, err := buildUser(req.Username, req.FullName, req.Email, req.Password, models.RolePatient)
	if err != nil {
		badRequest(c, err)
		return
	}

	patient := models.Patient{
		BloodGroup:            req.BloodGroup,
		HeightCm:              req.HeightCm,
		WeightKg:              req.WeightKg,
		EmergencyContactEmail: normalizeOptionalEmail(req.EmergencyContactEmail),
	}

	err = s.cfg.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(user).Error; err != nil {
			return err
		}

		patient.UserID = user.ID

		return tx.Create(&patient).Error
	})
	if err != nil {
		writeCreateError(c, err)
		return
	}

	s.respondWithToken(c, user, &patient)
}

func (s *Server) registerDoctor(c *gin.Context) {
	var req registerDoctorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err)
		return
	}

	user, err := buildUser(req.Username, req.FullName, req.Email, req.Password, models.RoleDoctor)
	if err != nil {
		badRequest(c, err)
		return
	}

	doctor := models.Doctor{
		HospitalID:    req.HospitalID,
		Qualification: strings.TrimSpace(req.Qualification),
		Position:      trimOptional(req.Position),
	}

	err = s.cfg.DB.Transaction(func(tx *gorm.DB) error {
		var count int64
		if err := tx.Model(&models.Hospital{}).Where("id = ?", req.HospitalID).Count(&count).Error; err != nil {
			return err
		}

		if count == 0 {
			return errUnknownHospital
		}

		if err := tx.Create(user).Error; err != nil {
			return err
		}

		doctor.UserID = user.ID

		return tx.Create(&doctor).Error
	})
	if err != nil {
		if errors.Is(err, errUnknownHospital) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "hospital not found"})
			return
		}

		writeCreateError(c, err)
		return
	}

	s.respondWithToken(c, user, &doctor)
}

var errUnknownHospital = errors.New("hospital not found")

func buildUser(username, fullName, email, password string, role models.Role) (*models.User, error) {
	hash, err := utils.HashPassword(password)
	if err != nil {
		return nil, err
	}

	return &models.User{
		Username:     strings.ToLower(strings.TrimSpace(username)),
		FullName:     strings.TrimSpace(fullName),
		Email:        strings.ToLower(strings.TrimSpace(email)),
		PasswordHash: hash,
		Role:         role,
	}, nil
}

func (s *Server) respondWithToken(c *gin.Context, user *models.User, profile any) {
	token, err := s.cfg.JWT.Encode(user.ID, user.Role)
	if err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not issue token"})
		return
	}

	c.JSON(http.StatusCreated, authResponse{
		Token:     token,
		ExpiresIn: int64(s.cfg.JWT.TTL().Seconds()),
		User:      user,
		Profile:   profile,
	})
}

func badRequest(c *gin.Context, err error) {
	c.Error(err)
	c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
}

func writeCreateError(c *gin.Context, err error) {
	c.Error(err)

	if field := duplicateField(err); field != "" {
		c.JSON(http.StatusConflict, gin.H{"error": field + " already registered"})
		return
	}

	c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create account"})
}

func duplicateField(err error) string {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != uniqueViolationCode {
		return ""
	}

	switch pgErr.ConstraintName {
	case "users_email_key":
		return "email"
	case "users_username_key":
		return "username"
	case "patients_user_key", "doctors_user_key":
		return "profile"
	default:
		return "record"
	}
}

func normalizeOptionalEmail(email *string) *string {
	if email == nil {
		return nil
	}

	normalized := strings.ToLower(strings.TrimSpace(*email))
	if normalized == "" {
		return nil
	}

	return &normalized
}

func trimOptional(value *string) *string {
	if value == nil {
		return nil
	}

	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}

	return &trimmed
}

type loginRequest struct {
	Identifier string `json:"identifier" binding:"required,min=3,max=254"`
	Password   string `json:"password" binding:"required,max=72"`
}

type loginResponse struct {
	Token     string       `json:"token"`
	ExpiresIn int64        `json:"expires_in"`
	Role      models.Role  `json:"role"`
	User      *models.User `json:"user"`
}

func (s *Server) login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err)
		return
	}

	identifier := strings.ToLower(strings.TrimSpace(req.Identifier))

	var user models.User
	lookupErr := s.cfg.DB.
		Where("lower(username) = ? OR lower(email) = ?", identifier, identifier).
		First(&user).Error

	if lookupErr != nil && !errors.Is(lookupErr, gorm.ErrRecordNotFound) {
		c.Error(lookupErr)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not sign in"})
		return
	}

	if err := utils.ComparePassword(user.PasswordHash, req.Password); err != nil || lookupErr != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
		return
	}

	token, err := s.cfg.JWT.Encode(user.ID, user.Role)
	if err != nil {
		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not issue token"})
		return
	}

	c.JSON(http.StatusOK, loginResponse{
		Token:     token,
		ExpiresIn: int64(s.cfg.JWT.TTL().Seconds()),
		Role:      user.Role,
		User:      &user,
	})
}
