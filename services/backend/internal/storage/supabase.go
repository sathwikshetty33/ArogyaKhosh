package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

var ErrAlreadyExists = errors.New("object already exists")

const (
	storagePrefix     = "/storage/v1"
	maxErrorBodyBytes = 4 << 10
)

type SupabaseConfig struct {
	URL        string
	ServiceKey string
	Bucket     string
	HTTPClient *http.Client
}

type Supabase struct {
	baseURL    string
	serviceKey string
	bucket     string
	client     *http.Client
}

func NewSupabase(cfg SupabaseConfig) (*Supabase, error) {
	trimmed := strings.TrimRight(strings.TrimSpace(cfg.URL), "/")
	if trimmed == "" {
		return nil, errors.New("supabase url is required")
	}

	if _, err := url.ParseRequestURI(trimmed); err != nil {
		return nil, fmt.Errorf("supabase url is invalid: %w", err)
	}

	if strings.TrimSpace(cfg.ServiceKey) == "" {
		return nil, errors.New("supabase service key is required")
	}

	if strings.TrimSpace(cfg.Bucket) == "" {
		return nil, errors.New("supabase bucket is required")
	}

	client := cfg.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 30 * time.Second}
	}

	return &Supabase{
		baseURL:    trimmed + storagePrefix,
		serviceKey: strings.TrimSpace(cfg.ServiceKey),
		bucket:     strings.TrimSpace(cfg.Bucket),
		client:     client,
	}, nil
}

func (s *Supabase) Upload(ctx context.Context, object Object) error {
	if err := validateKey(object.Key); err != nil {
		return err
	}

	if object.Body == nil {
		return ErrMissingBody
	}

	endpoint := s.objectURL("object", object.Key)

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, object.Body)
	if err != nil {
		return fmt.Errorf("build upload request: %w", err)
	}

	request.Header.Set("Authorization", "Bearer "+s.serviceKey)
	request.Header.Set("x-upsert", "false")
	request.Header.Set("Cache-Control", "no-store")

	if object.ContentType != "" {
		request.Header.Set("Content-Type", object.ContentType)
	}

	if object.Size > 0 {
		request.ContentLength = object.Size
	}

	response, err := s.client.Do(request)
	if err != nil {
		return fmt.Errorf("upload object: %w", err)
	}
	defer drain(response)

	return s.checkStatus(response, "upload object")
}

func (s *Supabase) SignedURL(ctx context.Context, key string, ttl time.Duration) (string, error) {
	if err := validateKey(key); err != nil {
		return "", err
	}

	if ttl <= 0 {
		return "", errors.New("signed url ttl must be positive")
	}

	payload, err := json.Marshal(map[string]int{"expiresIn": int(ttl.Seconds())})
	if err != nil {
		return "", fmt.Errorf("encode sign request: %w", err)
	}

	endpoint := s.objectURL("object/sign", key)

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return "", fmt.Errorf("build sign request: %w", err)
	}

	request.Header.Set("Authorization", "Bearer "+s.serviceKey)
	request.Header.Set("Content-Type", "application/json")

	response, err := s.client.Do(request)
	if err != nil {
		return "", fmt.Errorf("sign object: %w", err)
	}
	defer drain(response)

	if err := s.checkStatus(response, "sign object"); err != nil {
		return "", err
	}

	var body struct {
		SignedURL string `json:"signedURL"`
		SignedUrl string `json:"signedUrl"`
	}

	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		return "", fmt.Errorf("decode sign response: %w", err)
	}

	signed := body.SignedURL
	if signed == "" {
		signed = body.SignedUrl
	}

	if signed == "" {
		return "", errors.New("sign object: response did not contain a signed url")
	}

	if strings.HasPrefix(signed, "http://") || strings.HasPrefix(signed, "https://") {
		return signed, nil
	}

	return s.baseURL + "/" + strings.TrimPrefix(signed, "/"), nil
}

func (s *Supabase) Delete(ctx context.Context, key string) error {
	if err := validateKey(key); err != nil {
		return err
	}

	endpoint := s.objectURL("object", key)

	request, err := http.NewRequestWithContext(ctx, http.MethodDelete, endpoint, nil)
	if err != nil {
		return fmt.Errorf("build delete request: %w", err)
	}

	request.Header.Set("Authorization", "Bearer "+s.serviceKey)

	response, err := s.client.Do(request)
	if err != nil {
		return fmt.Errorf("delete object: %w", err)
	}
	defer drain(response)

	return s.checkStatus(response, "delete object")
}

func (s *Supabase) objectURL(action, key string) string {
	segments := append([]string{action, s.bucket}, strings.Split(strings.Trim(key, "/"), "/")...)

	joined, err := url.JoinPath(s.baseURL, segments...)
	if err != nil {
		escaped := make([]string, 0, len(segments))
		for _, segment := range segments {
			escaped = append(escaped, url.PathEscape(segment))
		}

		return s.baseURL + "/" + strings.Join(escaped, "/")
	}

	return joined
}

func (s *Supabase) checkStatus(response *http.Response, action string) error {
	if response.StatusCode >= 200 && response.StatusCode < 300 {
		return nil
	}

	body, _ := io.ReadAll(io.LimitReader(response.Body, maxErrorBodyBytes))

	status, message := apiError(response, body)

	if status == http.StatusNotFound {
		return ErrNotFound
	}

	if status == http.StatusConflict {
		return fmt.Errorf("%s: %w: %s", action, ErrAlreadyExists, message)
	}

	return fmt.Errorf("%s: supabase returned %d: %s", action, status, message)
}

// Supabase answers with HTTP 400 and nests the meaningful status in the body,
// so the transport status alone cannot distinguish "missing" from "duplicate".
func apiError(response *http.Response, body []byte) (int, string) {
	status := response.StatusCode

	message := strings.TrimSpace(string(body))
	if message == "" {
		message = response.Status
	}

	var parsed struct {
		StatusCode json.RawMessage `json:"statusCode"`
		Message    string          `json:"message"`
		Error      string          `json:"error"`
	}

	if err := json.Unmarshal(body, &parsed); err != nil {
		return status, message
	}

	if parsed.Message != "" {
		message = parsed.Message
	} else if parsed.Error != "" {
		message = parsed.Error
	}

	if len(parsed.StatusCode) > 0 {
		raw := strings.Trim(string(parsed.StatusCode), `"`)
		if nested, err := strconv.Atoi(raw); err == nil && nested >= 100 && nested < 600 {
			status = nested
		}
	}

	return status, message
}

func drain(response *http.Response) {
	_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, maxErrorBodyBytes))
	_ = response.Body.Close()
}

var _ Provider = (*Supabase)(nil)
