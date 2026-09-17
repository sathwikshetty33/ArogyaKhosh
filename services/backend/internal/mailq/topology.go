package mailq

import (
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

const (
	Exchange    = "arogya.mail"
	DLXExchange = "arogya.mail.dlx"

	OutboundQueue = "mail.outbound"
	DeadQueue     = "mail.dead"

	SendKey = "send"
	DeadKey = "dead"

	maxPriority = 10
)

var retryTiers = []struct {
	Queue string
	Key   string
	TTL   time.Duration
}{
	{"mail.retry.1m", "retry.1m", time.Minute},
	{"mail.retry.5m", "retry.5m", 5 * time.Minute},
	{"mail.retry.25m", "retry.25m", 25 * time.Minute},
}

func MaxAttempts() int {
	return len(retryTiers) + 1
}

func declare(ch *amqp.Channel) error {
	for _, name := range []string{Exchange, DLXExchange} {
		if err := ch.ExchangeDeclare(name, "direct", true, false, false, false, nil); err != nil {
			return err
		}
	}

	outbound := amqp.Table{
		"x-max-priority":            int32(maxPriority),
		"x-dead-letter-exchange":    DLXExchange,
		"x-dead-letter-routing-key": retryTiers[0].Key,
	}

	if _, err := ch.QueueDeclare(OutboundQueue, true, false, false, false, outbound); err != nil {
		return err
	}

	if err := ch.QueueBind(OutboundQueue, SendKey, Exchange, false, nil); err != nil {
		return err
	}

	for _, tier := range retryTiers {
		args := amqp.Table{
			"x-message-ttl":             int32(tier.TTL / time.Millisecond),
			"x-dead-letter-exchange":    Exchange,
			"x-dead-letter-routing-key": SendKey,
		}

		if _, err := ch.QueueDeclare(tier.Queue, true, false, false, false, args); err != nil {
			return err
		}

		if err := ch.QueueBind(tier.Queue, tier.Key, DLXExchange, false, nil); err != nil {
			return err
		}
	}

	if _, err := ch.QueueDeclare(DeadQueue, true, false, false, false, nil); err != nil {
		return err
	}

	return ch.QueueBind(DeadQueue, DeadKey, DLXExchange, false, nil)
}

func retryKey(attempt int) string {
	if attempt < 1 {
		attempt = 1
	}

	if attempt > len(retryTiers) {
		return DeadKey
	}

	return retryTiers[attempt-1].Key
}
