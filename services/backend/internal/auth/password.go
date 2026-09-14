package utils

import (
	"errors"
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

const (
	MinPasswordLength = 8
	MaxPasswordLength = 72
)

var (
	ErrPasswordTooShort = errors.New("password must be at least 8 characters")
	ErrPasswordTooLong  = errors.New("password must be at most 72 bytes")
	ErrPasswordMismatch = errors.New("password does not match")
)

func HashPassword(password string) (string, error) {
	if len(password) < MinPasswordLength {
		return "", ErrPasswordTooShort
	}

	if len(password) > MaxPasswordLength {
		return "", ErrPasswordTooLong
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("hash password: %w", err)
	}

	return string(hash), nil
}

func ComparePassword(hash, password string) error {
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return ErrPasswordMismatch
	}

	return nil
}
