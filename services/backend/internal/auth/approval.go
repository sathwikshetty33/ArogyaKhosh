package utils

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	approvalKeyBytes = 32
	ApprovalKeyTTL   = 24 * time.Hour
)

var ErrApprovalKeyInvalid = errors.New("approval key is invalid")

// NewApprovalKey returns the key to put in the email and the hash to store.
// The raw key is never written down: a stolen database must not yield working
// links to patient records.
func NewApprovalKey() (raw string, hash string, err error) {
	buf := make([]byte, approvalKeyBytes)
	if _, err := rand.Read(buf); err != nil {
		return "", "", fmt.Errorf("generate approval key: %w", err)
	}

	raw = base64.RawURLEncoding.EncodeToString(buf)

	return raw, HashApprovalKey(raw), nil
}

func HashApprovalKey(raw string) string {
	sum := sha256.Sum256([]byte(raw))

	return hex.EncodeToString(sum[:])
}

// ApprovalKeyMatches compares in constant time so a caller cannot narrow the
// key down by measuring how long a rejection takes.
func ApprovalKeyMatches(storedHash, raw string) bool {
	if storedHash == "" || raw == "" {
		return false
	}

	return subtle.ConstantTimeCompare([]byte(storedHash), []byte(HashApprovalKey(raw))) == 1
}

// ValidApprovalKey rejects anything that could not have come from
// NewApprovalKey, so a malformed key never reaches the database.
func ValidApprovalKey(raw string) error {
	if strings.TrimSpace(raw) != raw || raw == "" {
		return ErrApprovalKeyInvalid
	}

	decoded, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil || len(decoded) != approvalKeyBytes {
		return ErrApprovalKeyInvalid
	}

	return nil
}
