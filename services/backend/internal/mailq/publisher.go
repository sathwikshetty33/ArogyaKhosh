package mailq

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	amqp "github.com/rabbitmq/amqp091-go"
)

var ErrUnavailable = errors.New("the mail queue is unavailable")

const (
	confirmTimeout = 5 * time.Second
	redialDelay    = 3 * time.Second
)

type Publisher interface {
	Publish(ctx context.Context, job Job) error
	Healthy() bool
	Close() error
}

type Client struct {
	url string

	mu      sync.Mutex
	conn    *amqp.Connection
	channel *amqp.Channel
	confirm chan amqp.Confirmation
	closed  bool
}

func Dial(url string) (*Client, error) {
	c := &Client{url: url}
	if err := c.connect(); err != nil {
		return nil, err
	}

	return c, nil
}

func (c *Client) connect() error {
	conn, err := amqp.Dial(c.url)
	if err != nil {
		return fmt.Errorf("%w: %s", ErrUnavailable, err)
	}

	channel, err := conn.Channel()
	if err != nil {
		conn.Close()
		return fmt.Errorf("%w: %s", ErrUnavailable, err)
	}

	if err := declare(channel); err != nil {
		conn.Close()
		return fmt.Errorf("declare topology: %w", err)
	}

	if err := channel.Confirm(false); err != nil {
		conn.Close()
		return fmt.Errorf("enable confirms: %w", err)
	}

	c.conn = conn
	c.channel = channel
	c.confirm = channel.NotifyPublish(make(chan amqp.Confirmation, 64))

	return nil
}

func (c *Client) Publish(ctx context.Context, job Job) error {
	body, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("encode job: %w", err)
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return ErrUnavailable
	}

	if err := c.ensure(); err != nil {
		return err
	}

	publishing := amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		Priority:     job.Kind.Priority(),
		MessageId:    uuid.NewString(),
		Timestamp:    time.Now(),
		Body:         body,
		Headers:      amqp.Table{"x-kind": string(job.Kind)},
	}

	confirmed, err := c.publishConfirmed(ctx, publishing)
	if err == nil && confirmed {
		return nil
	}

	if reconnectErr := c.reconnect(); reconnectErr != nil {
		return reconnectErr
	}

	confirmed, err = c.publishConfirmed(ctx, publishing)
	if err != nil {
		return err
	}

	if !confirmed {
		return fmt.Errorf("%w: the broker did not confirm the message", ErrUnavailable)
	}

	return nil
}

func (c *Client) publishConfirmed(ctx context.Context, publishing amqp.Publishing) (bool, error) {
	if c.channel == nil {
		return false, ErrUnavailable
	}

	if err := c.channel.PublishWithContext(ctx, Exchange, SendKey, false, false, publishing); err != nil {
		return false, fmt.Errorf("%w: %s", ErrUnavailable, err)
	}

	select {
	case confirmation, ok := <-c.confirm:
		if !ok {
			return false, ErrUnavailable
		}

		return confirmation.Ack, nil
	case <-time.After(confirmTimeout):
		return false, fmt.Errorf("%w: timed out waiting for confirmation", ErrUnavailable)
	case <-ctx.Done():
		return false, ctx.Err()
	}
}

func (c *Client) ensure() error {
	if c.channel != nil && !c.channel.IsClosed() && c.conn != nil && !c.conn.IsClosed() {
		return nil
	}

	return c.reconnect()
}

func (c *Client) reconnect() error {
	if c.conn != nil {
		c.conn.Close()
	}

	c.conn = nil
	c.channel = nil

	return c.connect()
}

func (c *Client) Healthy() bool {
	c.mu.Lock()
	defer c.mu.Unlock()

	return !c.closed && c.conn != nil && !c.conn.IsClosed()
}

func (c *Client) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.closed = true

	if c.conn == nil {
		return nil
	}

	return c.conn.Close()
}

var _ Publisher = (*Client)(nil)
