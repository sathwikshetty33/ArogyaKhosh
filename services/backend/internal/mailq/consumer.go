package mailq

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

type Handler func(ctx context.Context, job Job) error

type ConsumerConfig struct {
	URL     string
	Workers int
	Handler Handler
	Logger  *log.Logger
}

func Run(ctx context.Context, cfg ConsumerConfig) {
	for {
		if err := consume(ctx, cfg); err != nil && ctx.Err() == nil {
			cfg.Logger.Printf("mail consumer: %v; retrying in %s", err, redialDelay)
		}

		select {
		case <-ctx.Done():
			return
		case <-time.After(redialDelay):
		}
	}
}

func consume(ctx context.Context, cfg ConsumerConfig) error {
	conn, err := amqp.Dial(cfg.URL)
	if err != nil {
		return err
	}
	defer conn.Close()

	workers := cfg.Workers
	if workers < 1 {
		workers = 1
	}

	channels := make([]*amqp.Channel, 0, workers)

	defer func() {
		for _, channel := range channels {
			channel.Close()
		}
	}()

	var wg sync.WaitGroup

	for i := 0; i < workers; i++ {
		channel, err := conn.Channel()
		if err != nil {
			return err
		}

		channels = append(channels, channel)

		if err := declare(channel); err != nil {
			return err
		}

		if err := channel.Qos(1, 0, false); err != nil {
			return err
		}

		deliveries, err := channel.Consume(OutboundQueue, "", false, false, false, false, nil)
		if err != nil {
			return err
		}

		wg.Add(1)

		go func(channel *amqp.Channel, deliveries <-chan amqp.Delivery) {
			defer wg.Done()

			for delivery := range deliveries {
				handle(ctx, channel, delivery, cfg)
			}
		}(channel, deliveries)
	}

	cfg.Logger.Printf("mail consumer ready, %d workers", workers)

	closed := conn.NotifyClose(make(chan *amqp.Error, 1))

	select {
	case <-ctx.Done():
		err = nil
	case amqpErr := <-closed:
		err = amqpErr
	}

	for _, channel := range channels {
		channel.Close()
	}

	wg.Wait()

	return err
}

func handle(ctx context.Context, channel *amqp.Channel, delivery amqp.Delivery, cfg ConsumerConfig) {
	var job Job
	if err := json.Unmarshal(delivery.Body, &job); err != nil {
		cfg.Logger.Printf("mail consumer: undecodable message %s: %v", delivery.MessageId, err)
		bury(ctx, channel, delivery, cfg)

		return
	}

	if err := cfg.Handler(ctx, job); err != nil {
		attempt := attemptsSoFar(delivery) + 1
		cfg.Logger.Printf("mail consumer: %s attempt %d failed: %v", job.Kind, attempt, err)

		if attempt >= MaxAttempts() {
			bury(ctx, channel, delivery, cfg)
			return
		}

		if attempt == 1 {
			if err := delivery.Nack(false, false); err != nil {
				cfg.Logger.Printf("mail consumer: nack failed: %v", err)
			}

			return
		}

		requeueAt(ctx, channel, delivery, retryKey(attempt), cfg)

		return
	}

	if err := delivery.Ack(false); err != nil {
		cfg.Logger.Printf("mail consumer: ack failed: %v", err)
	}
}

func requeueAt(ctx context.Context, channel *amqp.Channel, delivery amqp.Delivery, key string, cfg ConsumerConfig) {
	republish(ctx, channel, delivery, key, cfg)
}

func bury(ctx context.Context, channel *amqp.Channel, delivery amqp.Delivery, cfg ConsumerConfig) {
	republish(ctx, channel, delivery, DeadKey, cfg)
}

func republish(ctx context.Context, channel *amqp.Channel, delivery amqp.Delivery, key string, cfg ConsumerConfig) {
	headers := amqp.Table{}
	for name, value := range delivery.Headers {
		headers[name] = value
	}

	headers["x-attempts"] = int32(attemptsSoFar(delivery) + 1)

	err := channel.PublishWithContext(ctx, DLXExchange, key, false, false, amqp.Publishing{
		ContentType:  delivery.ContentType,
		DeliveryMode: amqp.Persistent,
		Priority:     delivery.Priority,
		MessageId:    delivery.MessageId,
		Timestamp:    delivery.Timestamp,
		Headers:      headers,
		Body:         delivery.Body,
	})
	if err != nil {
		cfg.Logger.Printf("mail consumer: could not route %s to %s: %v", delivery.MessageId, key, err)
		return
	}

	if err := delivery.Ack(false); err != nil {
		cfg.Logger.Printf("mail consumer: ack after reroute failed: %v", err)
	}
}

func attemptsSoFar(delivery amqp.Delivery) int {
	if value, ok := delivery.Headers["x-attempts"]; ok {
		switch n := value.(type) {
		case int32:
			return int(n)
		case int64:
			return int(n)
		case int:
			return n
		}
	}

	deaths, ok := delivery.Headers["x-death"].([]interface{})
	if !ok || len(deaths) == 0 {
		return 0
	}

	total := 0

	for _, entry := range deaths {
		death, ok := entry.(amqp.Table)
		if !ok {
			continue
		}

		if count, ok := death["count"].(int64); ok {
			total += int(count)
		}
	}

	return total
}
