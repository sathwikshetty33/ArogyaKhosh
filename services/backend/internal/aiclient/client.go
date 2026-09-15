package aiclient

import (
	"context"
	"errors"
	"fmt"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"

	aiv1 "github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/gen/aiv1"
)

var (
	ErrUnavailable = errors.New("the model service is unavailable")
	ErrRejected    = errors.New("the model service rejected the image")
)

type Verdict struct {
	ModelName  string
	Confidence float64
	Threshold  float64
	IsAccident bool
}

type Verifier interface {
	VerifyAccident(ctx context.Context, image []byte, contentType string) (Verdict, error)
	Close() error
}

type Client struct {
	conn    *grpc.ClientConn
	client  aiv1.AccidentVerifierClient
	timeout time.Duration
}

func Dial(target string, timeout time.Duration) (*Client, error) {
	if timeout <= 0 {
		timeout = 10 * time.Second
	}

	// NewClient does not block, so a model service that is still loading does
	// not hold up API startup. The first call pays the connection cost.
	conn, err := grpc.NewClient(target, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("ai client: %w", err)
	}

	return &Client{conn: conn, client: aiv1.NewAccidentVerifierClient(conn), timeout: timeout}, nil
}

func (c *Client) VerifyAccident(ctx context.Context, image []byte, contentType string) (Verdict, error) {
	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	response, err := c.client.VerifyAccident(ctx, &aiv1.VerifyAccidentRequest{
		Image:       image,
		ContentType: contentType,
	})
	if err != nil {
		switch status.Code(err) {
		case codes.InvalidArgument:
			return Verdict{}, fmt.Errorf("%w: %s", ErrRejected, status.Convert(err).Message())
		case codes.Unavailable, codes.DeadlineExceeded:
			return Verdict{}, fmt.Errorf("%w: %s", ErrUnavailable, status.Convert(err).Message())
		default:
			return Verdict{}, fmt.Errorf("verify accident: %w", err)
		}
	}

	return Verdict{
		ModelName:  response.GetModelName(),
		Confidence: float64(response.GetConfidence()),
		Threshold:  float64(response.GetThreshold()),
		IsAccident: response.GetIsAccident(),
	}, nil
}

func (c *Client) Close() error {
	return c.conn.Close()
}

var _ Verifier = (*Client)(nil)
