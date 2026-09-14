package main

import "time"

const (
	envPort    = "PORT"
	envGinMode = "GIN_MODE"

	defaultPort    = "8080"
	defaultGinMode = "debug"

	readTimeout     = 10 * time.Second
	writeTimeout    = 30 * time.Second
	idleTimeout     = 60 * time.Second
	shutdownTimeout = 15 * time.Second
)
