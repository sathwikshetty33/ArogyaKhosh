package main

import (
	"log"
	"os"

	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/db"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/server"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/auth"
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

	cfg := server.Config{
		Port:            env(envPort, defaultPort),
		Mode:            ginMode(env(envGinMode, defaultGinMode)),
		ReadTimeout:     readTimeout,
		WriteTimeout:    writeTimeout,
		IdleTimeout:     idleTimeout,
		ShutdownTimeout: shutdownTimeout,
		DB:              gdb,
		JWT:             jwtManager,
	}

	srv := server.New(cfg)

	log.Printf("arogyakhosh api listening on :%s", cfg.Port)
	if err := srv.Run(); err != nil {
		log.Fatalf("server error: %v", err)
	}
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
