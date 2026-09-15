package server

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/models"
)

type meResponse struct {
	CurrentUserID int64           `json:"current_user_id"`
	Role          models.Role     `json:"role"`
	User          *models.User    `json:"user"`
	Patient       *models.Patient `json:"patient,omitempty"`
	Doctor        *models.Doctor  `json:"doctor,omitempty"`
}

func (s *Server) getMe(c *gin.Context) {
	claims := claimsFrom(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
		return
	}

	var user models.User
	if err := s.cfg.DB.First(&user, claims.UserID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "account no longer exists"})
			return
		}

		c.Error(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load account"})

		return
	}

	response := meResponse{
		CurrentUserID: user.ID,
		Role:          user.Role,
		User:          &user,
	}

	switch user.Role {
	case models.RolePatient:
		var patient models.Patient
		if err := s.cfg.DB.Where("user_id = ?", user.ID).First(&patient).Error; err == nil {
			response.Patient = &patient
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load profile"})

			return
		}
	case models.RoleDoctor:
		var doctor models.Doctor
		if err := s.cfg.DB.Preload("Hospital").Where("user_id = ?", user.ID).First(&doctor).Error; err == nil {
			doctor.User = nil
			response.Doctor = &doctor
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			c.Error(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load profile"})

			return
		}
	}

	c.JSON(http.StatusOK, response)
}
