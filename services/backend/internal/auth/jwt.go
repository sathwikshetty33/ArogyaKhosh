package utils

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/models"
)

const (
	MinSecretLength = 32

	clockSkewLeeway = 30 * time.Second
)

var (
	ErrInvalidToken = errors.New("invalid token")
	ErrExpiredToken = errors.New("token expired")
	ErrWeakSecret   = errors.New("jwt secret must be at least 32 bytes")
	ErrEmptyIssuer  = errors.New("jwt issuer must not be empty")
	ErrInvalidTTL   = errors.New("jwt ttl must be positive")
)

type Claims struct {
	UserID int64       `json:"uid"`
	Role   models.Role `json:"role"`

	jwt.RegisteredClaims
}

type JWTManager struct {
	secret []byte
	issuer string
	ttl    time.Duration
}

func NewJWTManager(secret, issuer string, ttl time.Duration) (*JWTManager, error) {
	if len(secret) < MinSecretLength {
		return nil, ErrWeakSecret
	}

	if issuer == "" {
		return nil, ErrEmptyIssuer
	}

	if ttl <= 0 {
		return nil, ErrInvalidTTL
	}

	return &JWTManager{
		secret: []byte(secret),
		issuer: issuer,
		ttl:    ttl,
	}, nil
}

func (m *JWTManager) TTL() time.Duration {
	return m.ttl
}

func (m *JWTManager) Encode(userID int64, role models.Role) (string, error) {
	if userID <= 0 {
		return "", fmt.Errorf("%w: user id must be positive", ErrInvalidToken)
	}

	tokenID, err := newTokenID()
	if err != nil {
		return "", err
	}

	now := time.Now()

	claims := Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        tokenID,
			Subject:   strconv.FormatInt(userID, 10),
			Issuer:    m.issuer,
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(m.ttl)),
		},
	}

	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.secret)
	if err != nil {
		return "", fmt.Errorf("sign token: %w", err)
	}

	return signed, nil
}

func (m *JWTManager) Decode(token string) (*Claims, error) {
	claims := &Claims{}

	parsed, err := jwt.ParseWithClaims(
		token,
		claims,
		func(*jwt.Token) (any, error) { return m.secret, nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(m.issuer),
		jwt.WithExpirationRequired(),
		jwt.WithLeeway(clockSkewLeeway),
	)
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}

		return nil, fmt.Errorf("%w: %s", ErrInvalidToken, err)
	}

	if !parsed.Valid {
		return nil, ErrInvalidToken
	}

	if claims.UserID <= 0 {
		return nil, fmt.Errorf("%w: missing user id", ErrInvalidToken)
	}

	switch claims.Role {
	case models.RolePatient, models.RoleDoctor, models.RoleAdmin:
	default:
		return nil, fmt.Errorf("%w: unknown role %q", ErrInvalidToken, claims.Role)
	}

	return claims, nil
}

func newTokenID() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate token id: %w", err)
	}

	return hex.EncodeToString(buf), nil
}
