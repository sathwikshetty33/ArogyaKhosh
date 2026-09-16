package models

import (
	"time"

	"github.com/google/uuid"
)

type AccidentStatus string

const (
	AccidentReported  AccidentStatus = "reported"
	AccidentNotified  AccidentStatus = "notified"
	AccidentConfirmed AccidentStatus = "confirmed"
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

	DecidedAt *time.Time `json:"decided_at,omitempty"`

	// An accident authorises grants for a fixed window rather than forever.
	// The expiry is checked when a request is read, never swept by a job, so
	// a window that has run out cannot be used while a sweeper is behind.
	ExpiresAt *time.Time `json:"expires_at,omitempty"`

	// The emergency contact approves from an emailed link rather than an
	// account. Only the hash is stored: a leaked table must not hand anyone a
	// working key.
	ApprovalKeyHash      *string    `gorm:"column:approval_key_hash;type:text" json:"-"`
	ApprovalKeyExpiresAt *time.Time `json:"approval_key_expires_at,omitempty"`
	ApprovalUsedAt       *time.Time `json:"approval_used_at,omitempty"`

	CreatedAt time.Time `gorm:"index:accidents_patient_idx,priority:2,sort:desc" json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
