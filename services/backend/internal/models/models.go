package models

import (
	"time"

	"github.com/google/uuid"
)

type Role string

const (
	RolePatient Role = "patient"
	RoleDoctor  Role = "doctor"
	RoleAdmin   Role = "admin"
)

type Visibility string

const (
	VisibilityPublic  Visibility = "public"
	VisibilityPrivate Visibility = "private"
)

type RequestStatus string

const (
	RequestPending  RequestStatus = "pending"
	RequestGranted  RequestStatus = "granted"
	RequestDeclined RequestStatus = "declined"
	RequestRevoked  RequestStatus = "revoked"
)

type User struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:uuidv7()" json:"id"`
	Username     string    `gorm:"type:text;not null;uniqueIndex:users_username_key,expression:lower(username)" json:"username"`
	FullName     string    `gorm:"type:text;not null" json:"full_name"`
	Email        string    `gorm:"type:text;not null;uniqueIndex:users_email_key,expression:lower(email)" json:"email"`
	PasswordHash string    `gorm:"type:text;not null" json:"-"`
	Role         Role      `gorm:"type:text;not null;check:users_role_valid,role IN ('patient','doctor','admin')" json:"role"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Patient struct {
	ID     uuid.UUID `gorm:"type:uuid;primaryKey;default:uuidv7()" json:"id"`
	UserID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:patients_user_key" json:"user_id"`
	User   *User     `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`

	BloodGroup            *string  `gorm:"type:text;check:patients_blood_group_valid,blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')" json:"blood_group"`
	HeightCm              *float64 `gorm:"type:numeric(5,2);check:patients_height_positive,height_cm > 0" json:"height_cm"`
	WeightKg              *float64 `gorm:"type:numeric(5,2);check:patients_weight_positive,weight_kg > 0" json:"weight_kg"`
	EmergencyContactEmail *string  `gorm:"type:text" json:"emergency_contact_email"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Hospital struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:uuidv7()" json:"id"`
	Name         string    `gorm:"type:text;not null" json:"name"`
	License      *string   `gorm:"type:text" json:"license"`
	Address      *string   `gorm:"type:text" json:"address"`
	City         *string   `gorm:"type:text" json:"city"`
	ContactEmail *string   `gorm:"type:text" json:"contact_email"`
	ContactPhone *string   `gorm:"type:text" json:"contact_phone"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Doctor struct {
	ID     uuid.UUID `gorm:"type:uuid;primaryKey;default:uuidv7()" json:"id"`
	UserID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:doctors_user_key" json:"user_id"`
	User   *User     `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`

	HospitalID uuid.UUID `gorm:"type:uuid;not null;index:doctors_hospital_idx" json:"hospital_id"`
	Hospital   *Hospital `gorm:"foreignKey:HospitalID;constraint:OnDelete:RESTRICT" json:"hospital,omitempty"`

	Qualification string  `gorm:"type:text;not null" json:"qualification"`
	Position      *string `gorm:"type:text" json:"position"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type PatientDocument struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:uuidv7()" json:"id"`
	PatientID uuid.UUID `gorm:"type:uuid;not null;index:patient_documents_patient_idx,priority:1" json:"patient_id"`
	Patient   *Patient  `gorm:"foreignKey:PatientID;constraint:OnDelete:CASCADE" json:"patient,omitempty"`

	Name        string     `gorm:"type:text;not null" json:"name"`
	StorageKey  string     `gorm:"type:text;not null;uniqueIndex:patient_documents_storage_key" json:"storage_key"`
	Visibility  Visibility `gorm:"type:text;not null;default:private;check:patient_documents_visibility_valid,visibility IN ('public','private')" json:"visibility"`
	ContentType *string    `gorm:"type:text" json:"content_type"`
	SizeBytes   *int64     `gorm:"check:patient_documents_size_non_negative,size_bytes >= 0" json:"size_bytes"`

	CreatedAt time.Time `gorm:"index:patient_documents_patient_idx,priority:2,sort:desc" json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type DocumentRequest struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey;default:uuidv7()" json:"id"`

	PatientID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:document_requests_single_pending_idx,priority:1,where:status = 'pending';index:document_requests_grantee_idx,priority:2,where:status = 'granted'" json:"patient_id"`
	Patient   *Patient  `gorm:"foreignKey:PatientID;constraint:OnDelete:CASCADE" json:"patient,omitempty"`

	DoctorID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:document_requests_single_pending_idx,priority:2;index:document_requests_grantee_idx,priority:1" json:"doctor_id"`
	Doctor   *Doctor   `gorm:"foreignKey:DoctorID;constraint:OnDelete:CASCADE" json:"doctor,omitempty"`

	Status         RequestStatus `gorm:"type:text;not null;default:pending;check:document_requests_status_valid,status IN ('pending','granted','declined','revoked')" json:"status"`
	GrantedByEmail *string       `gorm:"type:text;check:document_requests_grant_complete,status <> 'granted' OR (granted_by_email IS NOT NULL AND granted_at IS NOT NULL)" json:"granted_by_email"`
	GrantedAt      *time.Time    `json:"granted_at"`
	ExpiresAt      *time.Time    `json:"expires_at"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
