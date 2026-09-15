package mailer

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"net/mail"
	"net/smtp"
	"strings"
	"time"
)

const (
	implicitTLSPort = 465
	defaultTimeout  = 20 * time.Second
)

type Config struct {
	Host     string
	Port     int
	Username string
	Password string

	// From is the envelope and header sender, e.g. "ArogyaKhosh <alerts@example.com>".
	From string

	// AllowInsecure permits a plaintext session when the server offers no TLS.
	// Only for a local catcher such as Mailpit; never against a real provider,
	// because the password crosses the wire in the clear.
	AllowInsecure bool

	Timeout time.Duration
}

type SMTP struct {
	cfg    Config
	from   mail.Address
	addr   string
	domain string
}

func NewSMTP(cfg Config) (*SMTP, error) {
	if strings.TrimSpace(cfg.Host) == "" {
		return nil, errors.New("smtp host is required")
	}

	if cfg.Port <= 0 || cfg.Port > 65535 {
		return nil, fmt.Errorf("smtp port %d is out of range", cfg.Port)
	}

	from, err := mail.ParseAddress(cfg.From)
	if err != nil {
		return nil, fmt.Errorf("from address is invalid: %w", err)
	}

	if cfg.Timeout <= 0 {
		cfg.Timeout = defaultTimeout
	}

	domain := cfg.Host
	if at := strings.LastIndex(from.Address, "@"); at >= 0 {
		domain = from.Address[at+1:]
	}

	return &SMTP{
		cfg:    cfg,
		from:   *from,
		addr:   net.JoinHostPort(cfg.Host, fmt.Sprint(cfg.Port)),
		domain: domain,
	}, nil
}

func (s *SMTP) Send(ctx context.Context, message Message) error {
	body, err := message.build(s.from, time.Now(), s.domain)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(ctx, s.cfg.Timeout)
	defer cancel()

	client, err := s.dial(ctx)
	if err != nil {
		return err
	}
	defer client.Close()

	if err := s.authenticate(client); err != nil {
		return err
	}

	if err := client.Mail(s.from.Address); err != nil {
		return fmt.Errorf("mail from: %w", err)
	}

	for _, address := range message.To {
		parsed, err := mail.ParseAddress(address)
		if err != nil {
			return fmt.Errorf("%w: %s", ErrBadAddress, address)
		}

		if err := client.Rcpt(parsed.Address); err != nil {
			return fmt.Errorf("rcpt to %s: %w", parsed.Address, err)
		}
	}

	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("data: %w", err)
	}

	if _, err := writer.Write(body); err != nil {
		return fmt.Errorf("write body: %w", err)
	}

	if err := writer.Close(); err != nil {
		return fmt.Errorf("finish body: %w", err)
	}

	return client.Quit()
}

func (s *SMTP) dial(ctx context.Context) (*smtp.Client, error) {
	dialer := &net.Dialer{}

	conn, err := dialer.DialContext(ctx, "tcp", s.addr)
	if err != nil {
		return nil, fmt.Errorf("dial %s: %w", s.addr, err)
	}

	if deadline, ok := ctx.Deadline(); ok {
		_ = conn.SetDeadline(deadline)
	}

	// Port 465 speaks TLS from the first byte. Everything else starts in the
	// clear and is upgraded with STARTTLS below.
	if s.cfg.Port == implicitTLSPort {
		conn = tls.Client(conn, &tls.Config{ServerName: s.cfg.Host})
	}

	client, err := smtp.NewClient(conn, s.cfg.Host)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("smtp handshake: %w", err)
	}

	if s.cfg.Port != implicitTLSPort {
		if ok, _ := client.Extension("STARTTLS"); ok {
			if err := client.StartTLS(&tls.Config{ServerName: s.cfg.Host}); err != nil {
				client.Close()
				return nil, fmt.Errorf("starttls: %w", err)
			}
		} else if !s.cfg.AllowInsecure {
			client.Close()
			return nil, errors.New("mail: server does not offer STARTTLS; set AllowInsecure to send anyway")
		}
	}

	return client, nil
}

func (s *SMTP) authenticate(client *smtp.Client) error {
	if s.cfg.Username == "" {
		return nil
	}

	// smtp.PlainAuth refuses to hand the password to an unencrypted connection,
	// which is what we want everywhere except a local catcher.
	if _, secure := client.TLSConnectionState(); !secure && !s.cfg.AllowInsecure {
		return errors.New("mail: refusing to send credentials over an unencrypted connection")
	}

	auth := smtp.PlainAuth("", s.cfg.Username, s.cfg.Password, s.cfg.Host)

	if ok, mechanisms := client.Extension("AUTH"); ok {
		if !strings.Contains(mechanisms, "PLAIN") && strings.Contains(mechanisms, "LOGIN") {
			return errors.New("mail: server only offers AUTH LOGIN, which is not supported")
		}
	}

	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("auth: %w", err)
	}

	return nil
}

var _ Mailer = (*SMTP)(nil)
var _ Mailer = Discard{}
