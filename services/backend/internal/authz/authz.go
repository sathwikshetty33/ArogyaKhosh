package authz

import (
	"errors"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/models"
)

type Level string

const (
	LevelOwner   Level = "owner"
	LevelGranted Level = "granted"
	LevelPublic  Level = "public"
	LevelDenied  Level = "denied"
)

func (l Level) CanReadAll() bool {
	return l == LevelOwner || l == LevelGranted
}

func PatientAccess(db *gorm.DB, userID uuid.UUID, role models.Role, patient *models.Patient) (Level, error) {
	if patient.UserID == userID {
		return LevelOwner, nil
	}

	if role != models.RoleDoctor {
		return LevelDenied, nil
	}

	var doctor models.Doctor
	if err := db.Where("user_id = ?", userID).First(&doctor).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return LevelDenied, nil
		}

		return LevelDenied, fmt.Errorf("load doctor: %w", err)
	}

	var granted int64
	if err := db.Model(&models.DocumentRequest{}).
		Where("patient_id = ? AND doctor_id = ? AND status = ?", patient.ID, doctor.ID, models.RequestGranted).
		Where("expires_at IS NULL OR expires_at > now()").
		Count(&granted).Error; err != nil {
		return LevelDenied, fmt.Errorf("check consent: %w", err)
	}

	if granted > 0 {
		return LevelGranted, nil
	}

	return LevelPublic, nil
}
