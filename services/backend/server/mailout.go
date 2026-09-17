package server

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/mailer"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/mailq"
)

func (s *Server) dispatch(ctx context.Context, kind mailq.Kind, accidentID uuid.UUID, message mailer.Message) error {
	if s.cfg.Queue == nil {
		return s.cfg.Mailer.Send(ctx, message)
	}

	err := s.cfg.Queue.Publish(ctx, mailq.Job{
		Kind:       kind,
		AccidentID: accidentID,
		Message:    message,
	})
	if err != nil {
		return fmt.Errorf("queueing %s: %w", kind, err)
	}

	return nil
}
