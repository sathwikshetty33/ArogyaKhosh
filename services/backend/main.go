package main

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"os"
	"strconv"
	"strings"

	"gorm.io/gorm"

	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/aiclient"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/auth"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/db"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/mailer"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/mailq"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/storage"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/server"
)

func main() {
	dsn := os.Getenv(envDatabaseURL)
	if dsn == "" {
		log.Fatalf("%s is required", envDatabaseURL)
	}

	gdb, err := db.Open(dsn)
	if err != nil {
		log.Fatalf("database: %v", err)
	}

	if err := db.Migrate(gdb); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	log.Print("schema migrated")

	jwtManager, err := utils.NewJWTManager(
		os.Getenv(envJWTSecret),
		env(envJWTIssuer, defaultJWTIssuer),
		accessTokenTTL,
	)
	if err != nil {
		log.Fatalf("jwt: %v", err)
	}

	objectStore, err := newObjectStore()
	if err != nil {
		log.Fatalf("storage: %v", err)
	}

	if objectStore == nil {
		log.Printf("object storage is not configured; set %s to enable document uploads", envSupabaseURL)
	} else {
		log.Print("object storage ready")
	}

	postman, err := newMailer()
	if err != nil {
		log.Fatalf("mail: %v", err)
	}

	grantSigner, err := utils.NewGrantSigner(os.Getenv(envJWTSecret))
	if err != nil {
		log.Fatalf("grant signer: %v", err)
	}

	var verifier aiclient.Verifier
	if addr := strings.TrimSpace(os.Getenv(envAIServiceAddr)); addr != "" {
		client, err := aiclient.Dial(addr, aiCallTimeout)
		if err != nil {
			log.Fatalf("model service: %v", err)
		}

		defer client.Close()

		verifier = client

		log.Printf("model service at %s", addr)
	} else {
		log.Printf("model service is not configured; accident photos will not be scored")
	}

	queue, err := newQueue()
	if err != nil {
		log.Fatalf("mail queue: %v", err)
	}

	if queue != nil {
		defer queue.Close()
	}

	cfg := server.Config{
		Port:            env(envPort, defaultPort),
		Mode:            ginMode(env(envGinMode, defaultGinMode)),
		ReadTimeout:     readTimeout,
		WriteTimeout:    writeTimeout,
		IdleTimeout:     idleTimeout,
		ShutdownTimeout: shutdownTimeout,
		DB:              gdb,
		JWT:             jwtManager,
		AllowedOrigins:  splitOrigins(env(envCORSOrigins, defaultCORSOrigins)),
		Storage:         objectStore,
		SignedURLTTL:    signedURLTTL,
		Mailer:          postman,
		AI:              verifier,
		GrantSigner:     grantSigner,
		AppBaseURL:      strings.TrimRight(env(envAppBaseURL, defaultAppBaseURL), "/"),
		Queue:           queue,
	}

	srv := server.New(cfg)

	background, stopBackground := context.WithCancel(context.Background())
	defer stopBackground()

	if queue != nil {
		go mailq.Run(background, mailq.ConsumerConfig{
			URL:     strings.TrimSpace(os.Getenv(envRabbitURL)),
			Workers: mailWorkers(),
			Handler: mailHandler(gdb, postman),
			Logger:  log.Default(),
		})

		go server.StrandedSweeper{
			DB:         gdb,
			Queue:      queue,
			AppBaseURL: cfg.AppBaseURL,
			Logger:     log.Default(),
			Every:      strandedSweepEvery,
			After:      strandedAfter,
		}.Run(background)
	}

	log.Printf("arogyakhosh api listening on :%s", cfg.Port)
	if err := srv.Run(); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func newQueue() (mailq.Publisher, error) {
	url := strings.TrimSpace(os.Getenv(envRabbitURL))
	if url == "" {
		log.Printf("mail queue is not configured; alerts will be sent inline with no retry")
		return nil, nil
	}

	client, err := mailq.Dial(url)
	if err != nil {
		return nil, err
	}

	log.Printf("mail queue ready at %s", redactURL(url))

	return client, nil
}

func redactURL(raw string) string {
	parsed, err := url.Parse(raw)
	if err != nil {
		return "the configured broker"
	}

	if parsed.User != nil {
		parsed.User = url.User(parsed.User.Username())
	}

	return parsed.String()
}

func mailWorkers() int {
	raw := strings.TrimSpace(os.Getenv(envMailWorkers))
	if raw == "" {
		return defaultMailWorkers
	}

	parsed, err := strconv.Atoi(raw)
	if err != nil || parsed < 1 {
		log.Printf("%s is not a positive number; using %d", envMailWorkers, defaultMailWorkers)
		return defaultMailWorkers
	}

	return parsed
}

func mailHandler(gdb *gorm.DB, postman mailer.Mailer) mailq.Handler {
	return func(ctx context.Context, job mailq.Job) error {
		if err := postman.Send(ctx, job.Message); err != nil {
			return err
		}

		if job.Kind != mailq.KindAccidentAlert || len(job.Message.To) == 0 {
			return nil
		}

		return server.MarkAlerted(gdb, job.AccidentID, job.Message.To[0])
	}
}

func newMailer() (mailer.Mailer, error) {
	host := strings.TrimSpace(os.Getenv(envSMTPHost))
	if host == "" {
		log.Printf("smtp is not configured; alerts will be logged instead of sent")
		return mailer.Discard{}, nil
	}

	port := defaultSMTPPort
	if raw := strings.TrimSpace(os.Getenv(envSMTPPort)); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil {
			return nil, fmt.Errorf("%s must be a number: %w", envSMTPPort, err)
		}

		port = parsed
	}

	sender, err := mailer.NewSMTP(mailer.Config{
		Host:          host,
		Port:          port,
		Username:      os.Getenv(envSMTPUsername),
		Password:      os.Getenv(envSMTPPassword),
		From:          os.Getenv(envSMTPFrom),
		AllowInsecure: strings.EqualFold(strings.TrimSpace(os.Getenv(envSMTPAllowInsecure)), "true"),
		Timeout:       smtpTimeout,
	})
	if err != nil {
		return nil, err
	}

	log.Printf("smtp ready at %s:%d", host, port)

	return sender, nil
}

func newObjectStore() (storage.Provider, error) {
	url := strings.TrimSpace(os.Getenv(envSupabaseURL))
	key := strings.TrimSpace(os.Getenv(envSupabaseKey))

	if url == "" && key == "" {
		return nil, nil
	}

	provider, err := storage.NewSupabase(storage.SupabaseConfig{
		URL:        url,
		ServiceKey: key,
		Bucket:     env(envSupabaseBucket, defaultSupabaseBucket),
	})
	if err != nil {
		return nil, err
	}

	return provider, nil
}

func splitOrigins(raw string) []string {
	parts := strings.Split(raw, ",")

	origins := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			origins = append(origins, trimmed)
		}
	}

	return origins
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func ginMode(mode string) string {
	switch mode {
	case "debug", "release", "test":
		return mode
	default:
		log.Printf("unknown %s=%q, falling back to %q", envGinMode, mode, defaultGinMode)
		return defaultGinMode
	}
}
