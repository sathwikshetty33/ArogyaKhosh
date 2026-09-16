package server

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	utils "github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/auth"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/mailer"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/models"
)

// openAccident answers the only question the flow asks of the table: does this
// patient have an accident open right now. A report counts before anyone has
// confirmed it, because the contact may simply not have opened their mail yet
// and a doctor standing over the patient cannot wait on that.
//
// A row with no expiry is not open. Treating a missing window as an endless
// one is the wrong way for this to fail.
func (s *Server) openAccident(patientID uuid.UUID) (*models.Accident, error) {
	var accident models.Accident

	err := s.cfg.DB.
		Where("patient_id = ? AND status IN ?", patientID, []models.AccidentStatus{
			models.AccidentReported,
			models.AccidentNotified,
			models.AccidentConfirmed,
		}).
		Where("expires_at IS NOT NULL AND expires_at > now()").
		Order("created_at DESC").
		First(&accident).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}

		return nil, err
	}

	return &accident, nil
}

// sendGrantRequest mails the emergency contact a signed link for one request.
// Nothing is stored: the signature is what makes the link trustworthy, and the
// ids it carries are what say who the access is for.
func (s *Server) sendGrantRequest(c *gin.Context, patient *models.Patient, doctor *models.Doctor, request *models.DocumentRequest, accident *models.Accident) {
	if s.cfg.GrantSigner == nil {
		return
	}

	to := accidentContact(accident)
	if to == "" {
		return
	}

	// A link must not outlive the window it was minted under, so the shorter
	// of the two wins.
	expires := time.Now().Add(utils.GrantTokenTTL)
	if accident.ExpiresAt != nil && accident.ExpiresAt.Before(expires) {
		expires = *accident.ExpiresAt
	}

	token, err := s.cfg.GrantSigner.Sign(utils.GrantClaims{
		AccidentID: accident.ID,
		RequestID:  request.ID,
		ExpiresAt:  expires,
	})
	if err != nil {
		c.Error(fmt.Errorf("signing grant link: %w", err))
		return
	}

	link := fmt.Sprintf("%s/grant-access/%s", s.cfg.AppBaseURL, token)

	message := mailer.Message{
		To:      []string{to},
		Subject: fmt.Sprintf("%s has asked to see %s's records", doctorLabel(doctor), fullName(*patient)),
		Text:    grantRequestText(patient, doctor, accident, link),
		HTML:    grantRequestHTML(patient, doctor, accident, link),
	}

	if err := s.cfg.Mailer.Send(c.Request.Context(), message); err != nil {
		c.Error(fmt.Errorf("mailing grant request to %s: %w", to, err))
	}
}

func grantRequestText(patient *models.Patient, doctor *models.Doctor, accident *models.Accident, link string) string {
	var body strings.Builder

	fmt.Fprintf(&body, "%s has asked to read %s's medical records.\n\n", doctorLabel(doctor), fullName(*patient))
	body.WriteString(doctorDetail(doctor) + "\n\n")
	body.WriteString(standingLine(accident) + "\n\n")
	body.WriteString("To let this doctor in, open:\n\n")
	body.WriteString(link + "\n\n")
	body.WriteString("Access ends when the accident report closes. You can take it back\n")
	body.WriteString("at any time, and so can the patient.\n")

	return body.String()
}

func grantRequestHTML(patient *models.Patient, doctor *models.Doctor, accident *models.Accident, link string) string {
	return fmt.Sprintf(`<p><strong>%s</strong> has asked to read <strong>%s</strong>'s medical records.</p>
<p>%s</p>
<p>%s</p>
<p><a href="%s">Review this request</a></p>
<p>Access ends when the accident report closes. You can take it back at any time,
and so can the patient.</p>`,
		doctorLabel(doctor), fullName(*patient), doctorDetail(doctor), standingLine(accident), link)
}

// What gives the contact the right to answer depends on whether they have
// acted on the report yet. Telling someone they confirmed something they never
// opened is the kind of detail that makes a person distrust the whole mail.
func standingLine(accident *models.Accident) string {
	if accident.Status == models.AccidentConfirmed {
		return "You confirmed their accident, so this decision is yours until they can make it themselves."
	}

	return "An accident involving them was reported and you are their emergency contact, so you can answer this while they cannot."
}

func doctorLabel(doctor *models.Doctor) string {
	if doctor.User != nil {
		return doctor.User.FullName
	}

	return "A doctor"
}

func doctorDetail(doctor *models.Doctor) string {
	parts := []string{doctor.Qualification}

	if doctor.Position != nil && *doctor.Position != "" {
		parts = append(parts, *doctor.Position)
	}

	if doctor.Hospital != nil {
		parts = append(parts, doctor.Hospital.Name)
	}

	return strings.Join(parts, " · ")
}

func accidentContact(accident *models.Accident) string {
	if accident.NotifiedEmail != nil {
		return *accident.NotifiedEmail
	}

	return ""
}
