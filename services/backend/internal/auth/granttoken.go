package utils

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

const (
	grantPayloadBytes = 40 // accident uuid + request uuid + unix expiry
	grantDomain       = "arogyakhosh/grant-token/v1"
	GrantTokenTTL     = 48 * time.Hour
)

var (
	ErrGrantTokenInvalid = errors.New("grant token is invalid")
	ErrGrantTokenExpired = errors.New("grant token has expired")
)

type GrantClaims struct {
	AccidentID uuid.UUID
	RequestID  uuid.UUID
	ExpiresAt  time.Time
}

// GrantSigner mints the links emailed to an emergency contact when a doctor
// asks for a patient's records. Nothing is stored: the signature is what makes
// a link trustworthy, so only this server can produce one.
type GrantSigner struct {
	key []byte
}

func NewGrantSigner(secret string) (*GrantSigner, error) {
	if len(secret) < MinSecretLength {
		return nil, ErrWeakSecret
	}

	// Separate key material from the one signing sessions, so a token of one
	// kind can never be replayed as the other.
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(grantDomain))

	return &GrantSigner{key: mac.Sum(nil)}, nil
}

func (s *GrantSigner) Sign(claims GrantClaims) (string, error) {
	if claims.AccidentID == uuid.Nil || claims.RequestID == uuid.Nil {
		return "", fmt.Errorf("%w: accident and request are required", ErrGrantTokenInvalid)
	}

	if claims.ExpiresAt.IsZero() {
		return "", fmt.Errorf("%w: an expiry is required", ErrGrantTokenInvalid)
	}

	payload := make([]byte, 0, grantPayloadBytes)
	payload = append(payload, claims.AccidentID[:]...)
	payload = append(payload, claims.RequestID[:]...)
	payload = binary.BigEndian.AppendUint64(payload, uint64(claims.ExpiresAt.Unix()))

	encoded := base64.RawURLEncoding.EncodeToString(payload)

	return encoded + "." + base64.RawURLEncoding.EncodeToString(s.sign(payload)), nil
}

func (s *GrantSigner) Verify(token string) (GrantClaims, error) {
	encoded, signature, found := strings.Cut(token, ".")
	if !found {
		return GrantClaims{}, ErrGrantTokenInvalid
	}

	payload, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil || len(payload) != grantPayloadBytes {
		return GrantClaims{}, ErrGrantTokenInvalid
	}

	provided, err := base64.RawURLEncoding.DecodeString(signature)
	if err != nil {
		return GrantClaims{}, ErrGrantTokenInvalid
	}

	// Authenticate before reading anything out of the payload: an expiry we
	// have not verified is just an attacker's suggestion.
	if !hmac.Equal(provided, s.sign(payload)) {
		return GrantClaims{}, ErrGrantTokenInvalid
	}

	claims := GrantClaims{
		AccidentID: uuid.UUID(payload[0:16]),
		RequestID:  uuid.UUID(payload[16:32]),
		ExpiresAt:  time.Unix(int64(binary.BigEndian.Uint64(payload[32:40])), 0).UTC(),
	}

	if time.Now().After(claims.ExpiresAt) {
		return claims, ErrGrantTokenExpired
	}

	return claims, nil
}

func (s *GrantSigner) sign(payload []byte) []byte {
	mac := hmac.New(sha256.New, s.key)
	mac.Write(payload)

	return mac.Sum(nil)
}
