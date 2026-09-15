package main

import (
	"log"
	"os"
	"strings"

	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/auth"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/db"
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
	}

	srv := server.New(cfg)

	log.Printf("arogyakhosh api listening on :%s", cfg.Port)
	if err := srv.Run(); err != nil {
		log.Fatalf("server error: %v", err)
	}
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
