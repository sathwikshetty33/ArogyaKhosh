package server

import (
	"context"
	"fmt"
	"log"
	"time"

	"gorm.io/gorm"

	utils "github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/auth"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/mailer"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/mailq"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/models"
)

type StrandedSweeper struct {
	DB         *gorm.DB
	Queue      mailq.Publisher
	AppBaseURL string
	Logger     *log.Logger
	Every      time.Duration
	After      time.Duration
}

func (s StrandedSweeper) Run(ctx context.Context) {
	if s.Queue == nil {
		return
	}

	ticker := time.NewTicker(s.Every)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := s.sweep(ctx); err != nil {
				s.Logger.Printf("stranded alert sweep: %v", err)
			}
		}
	}
}

func (s StrandedSweeper) sweep(ctx context.Context) error {
	var stranded []models.Accident

	err := s.DB.Preload("Patient.User").
		Where("status = ? AND alert_queued_at IS NULL AND created_at < ?",
			models.AccidentReported, time.Now().Add(-s.After)).
		Limit(50).
		Find(&stranded).Error
	if err != nil {
		return err
	}

	for i := range stranded {
		accident := &stranded[i]

		if accident.Patient == nil || accident.Patient.EmergencyContactEmail == nil {
			continue
		}

		to := *accident.Patient.EmergencyContactEmail
		if to == "" {
			continue
		}

		rawKey, keyHash, err := utils.NewApprovalKey()
		if err != nil {
			return err
		}

		expires := time.Now().Add(utils.ApprovalKeyTTL)

		err = s.DB.Model(&models.Accident{}).Where("id = ?", accident.ID).
			Updates(map[string]any{
				"approval_key_hash":       keyHash,
				"approval_key_expires_at": expires,
			}).Error
		if err != nil {
			return err
		}

		link := fmt.Sprintf("%s/accept/%s/%s", s.AppBaseURL, accident.ID, rawKey)

		message := mailer.Message{
			To:      []string{to},
			Subject: fmt.Sprintf("%s may have been in an accident", fullName(*accident.Patient)),
			Text:    accidentAlertText(*accident.Patient, *accident, link),
			HTML:    accidentAlertHTML(*accident.Patient, *accident, link),
		}

		publishErr := s.Queue.Publish(ctx, mailq.Job{
			Kind:       mailq.KindAccidentAlert,
			AccidentID: accident.ID,
			Message:    message,
		})
		if publishErr != nil {
			return publishErr
		}

		now := time.Now()
		if err := s.DB.Model(&models.Accident{}).Where("id = ?", accident.ID).
			Update("alert_queued_at", now).Error; err != nil {
			return err
		}

		s.Logger.Printf("stranded alert sweep: requeued accident %s", accident.ID)
	}

	return nil
}
