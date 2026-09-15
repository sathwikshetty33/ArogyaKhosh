package mailer

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"mime"
	"mime/multipart"
	"net/mail"
	"net/textproto"
	"strings"
	"time"
)

var (
	ErrNoRecipients  = errors.New("mail: at least one recipient is required")
	ErrNoSubject     = errors.New("mail: subject is required")
	ErrNoBody        = errors.New("mail: a text or html body is required")
	ErrBadAddress    = errors.New("mail: invalid address")
	ErrHeaderInject  = errors.New("mail: header contains a line break")
	ErrNotConfigured = errors.New("mail: no smtp server is configured")
)

type Message struct {
	To      []string
	Subject string
	Text    string
	HTML    string
}

type Mailer interface {
	Send(ctx context.Context, message Message) error
}

// Discard stands in when no SMTP server is configured. It logs what would have
// been sent, so a development stack still shows the alert that a real one would
// have delivered.
type Discard struct{}

func (Discard) Send(_ context.Context, message Message) error {
	if err := message.validate(); err != nil {
		return err
	}

	log.Printf("mail not sent (no smtp configured): to=%s subject=%q",
		strings.Join(message.To, ","), message.Subject)

	return nil
}

func (m Message) validate() error {
	if len(m.To) == 0 {
		return ErrNoRecipients
	}

	for _, address := range m.To {
		if _, err := mail.ParseAddress(address); err != nil {
			return fmt.Errorf("%w: %s", ErrBadAddress, address)
		}
	}

	if strings.TrimSpace(m.Subject) == "" {
		return ErrNoSubject
	}

	if strings.TrimSpace(m.Text) == "" && strings.TrimSpace(m.HTML) == "" {
		return ErrNoBody
	}

	// A newline in a header lets a caller append headers of their own, so an
	// attacker-supplied name could add Bcc or replace the body.
	for _, value := range append([]string{m.Subject}, m.To...) {
		if strings.ContainsAny(value, "\r\n") {
			return fmt.Errorf("%w: %q", ErrHeaderInject, value)
		}
	}

	return nil
}

func messageID(domain string) string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("<%d@%s>", time.Now().UnixNano(), domain)
	}

	return fmt.Sprintf("<%s@%s>", hex.EncodeToString(buf), domain)
}

func (m Message) build(from mail.Address, now time.Time, domain string) ([]byte, error) {
	if err := m.validate(); err != nil {
		return nil, err
	}

	var body bytes.Buffer

	headers := textproto.MIMEHeader{}
	headers.Set("From", from.String())
	headers.Set("To", strings.Join(m.To, ", "))
	headers.Set("Subject", mime.QEncoding.Encode("utf-8", m.Subject))
	headers.Set("Date", now.Format(time.RFC1123Z))
	headers.Set("Message-ID", messageID(domain))
	headers.Set("MIME-Version", "1.0")

	switch {
	case m.HTML == "":
		headers.Set("Content-Type", `text/plain; charset="utf-8"`)
		writeHeaders(&body, headers)
		body.WriteString(normalise(m.Text))

	case m.Text == "":
		headers.Set("Content-Type", `text/html; charset="utf-8"`)
		writeHeaders(&body, headers)
		body.WriteString(normalise(m.HTML))

	default:
		var parts bytes.Buffer
		writer := multipart.NewWriter(&parts)

		headers.Set("Content-Type", "multipart/alternative; boundary="+writer.Boundary())
		writeHeaders(&body, headers)

		for _, part := range []struct{ kind, content string }{
			{`text/plain; charset="utf-8"`, m.Text},
			{`text/html; charset="utf-8"`, m.HTML},
		} {
			w, err := writer.CreatePart(textproto.MIMEHeader{"Content-Type": {part.kind}})
			if err != nil {
				return nil, fmt.Errorf("build part: %w", err)
			}

			if _, err := w.Write([]byte(normalise(part.content))); err != nil {
				return nil, fmt.Errorf("write part: %w", err)
			}
		}

		if err := writer.Close(); err != nil {
			return nil, fmt.Errorf("close parts: %w", err)
		}

		body.Write(parts.Bytes())
	}

	return body.Bytes(), nil
}

func writeHeaders(buf *bytes.Buffer, headers textproto.MIMEHeader) {
	for _, key := range []string{
		"From", "To", "Subject", "Date", "Message-ID", "MIME-Version", "Content-Type",
	} {
		if value := headers.Get(key); value != "" {
			fmt.Fprintf(buf, "%s: %s\r\n", key, value)
		}
	}

	buf.WriteString("\r\n")
}

// SMTP wants CRLF, and a bare LF in the body can desynchronise the DATA
// terminator on stricter servers.
func normalise(body string) string {
	body = strings.ReplaceAll(body, "\r\n", "\n")

	return strings.ReplaceAll(body, "\n", "\r\n")
}
