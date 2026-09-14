package main

import (
	"log"
	"os"

	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/server"
)

func main() {
	cfg := server.Config{
		Port:            env(envPort, defaultPort),
		Mode:            env(envGinMode, defaultGinMode),
		ReadTimeout:     readTimeout,
		WriteTimeout:    writeTimeout,
		IdleTimeout:     idleTimeout,
		ShutdownTimeout: shutdownTimeout,
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
