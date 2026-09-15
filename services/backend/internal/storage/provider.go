package storage

import (
	"context"
	"errors"
	"io"
	"path"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
)

var (
	ErrNotFound    = errors.New("object not found")
	ErrEmptyKey    = errors.New("object key must not be empty")
	ErrMissingBody = errors.New("object body must not be nil")
)

type Object struct {
	Key         string
	Body        io.Reader
	ContentType string
	Size        int64
}

type Provider interface {
	Upload(ctx context.Context, object Object) error
	SignedURL(ctx context.Context, key string, ttl time.Duration) (string, error)
	Delete(ctx context.Context, key string) error
}

var allowedExtensions = map[string]bool{
	".pdf":  true,
	".png":  true,
	".jpg":  true,
	".jpeg": true,
	".webp": true,
	".doc":  true,
	".docx": true,
	".txt":  true,
}

func ExtensionAllowed(filename string) bool {
	return allowedExtensions[strings.ToLower(path.Ext(filename))]
}

func AllowedExtensions() []string {
	list := make([]string, 0, len(allowedExtensions))
	for ext := range allowedExtensions {
		list = append(list, ext)
	}

	sort.Strings(list)

	return list
}

func NewKey(prefix, filename string) string {
	ext := strings.ToLower(path.Ext(filename))
	if !allowedExtensions[ext] {
		ext = ""
	}

	return path.Join(path.Clean("/" + prefix)[1:], uuid.NewString()+ext)
}

func validateKey(key string) error {
	if strings.TrimSpace(key) == "" {
		return ErrEmptyKey
	}

	return nil
}
