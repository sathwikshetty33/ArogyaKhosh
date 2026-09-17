package mailq

import (
	"github.com/google/uuid"

	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/mailer"
)

type Kind string

const (
	KindAccidentAlert Kind = "accident_alert"
	KindGrantRequest  Kind = "grant_request"
)

func (k Kind) Priority() uint8 {
	if k == KindAccidentAlert {
		return 9
	}

	return 5
}

type Job struct {
	Kind       Kind           `json:"kind"`
	AccidentID uuid.UUID      `json:"accident_id"`
	Message    mailer.Message `json:"message"`
}
