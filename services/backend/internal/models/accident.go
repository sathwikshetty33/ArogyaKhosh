package models

import (
	"time"

	"github.com/google/uuid"
)

type AccidentStatus string

const (
	AccidentReported  AccidentStatus = "reported"
	AccidentNotified  AccidentStatus = "notified"
	AccidentDismissed AccidentStatus = "dismissed"
	AccidentResolved  AccidentStatus = "resolved"
)

type Accident struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:uuidv7()" json:"id"`
	PatientID uuid.UUID `gorm:"type:uuid;not null;index:accidents_patient_idx,priority:1" json:"patient_id"`
	Patient   *Patient  `gorm:"foreignKey:PatientID;constraint:OnDelete:CASCADE" json:"patient,omitempty"`

	Status AccidentStatus `gorm:"type:text;not null;default:reported" json:"status"`

	PhotoKey         *string `gorm:"type:text" json:"photo_key,omitempty"`
	PhotoContentType *string `gorm:"type:text" json:"photo_content_type,omitempty"`
	PhotoSizeBytes   *int64  `json:"photo_size_bytes,omitempty"`

	ModelName      *string  `gorm:"type:text" json:"model_name,omitempty"`
	ModelThreshold *float64 `gorm:"type:numeric(6,5)" json:"model_threshold,omitempty"`
	Confidence     *float64 `gorm:"type:numeric(6,5)" json:"confidence,omitempty"`
	ModelVerdict   *bool    `json:"model_verdict,omitempty"`

	ReporterIP *string  `gorm:"type:text" json:"-"`
	Latitude   *float64 `gorm:"type:numeric(9,6)" json:"latitude,omitempty"`
	Longitude  *float64 `gorm:"type:numeric(9,6)" json:"longitude,omitempty"`

	NotifiedAt    *time.Time `json:"notified_at,omitempty"`
	NotifiedEmail *string    `gorm:"type:text" json:"notified_email,omitempty"`

	DocumentRequestID *uuid.UUID       `gorm:"type:uuid" json:"document_request_id,omitempty"`
	DocumentRequest   *DocumentRequest `gorm:"foreignKey:DocumentRequestID;constraint:OnDelete:SET NULL" json:"-"`

	CreatedAt time.Time `gorm:"index:accidents_patient_idx,priority:2,sort:desc" json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
