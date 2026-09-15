package main

import "time"

const (
	envPort        = "PORT"
	envGinMode     = "GIN_MODE"
	envDatabaseURL = "DATABASE_URL"
	envJWTSecret   = "JWT_SECRET"
	envJWTIssuer   = "JWT_ISSUER"
	envCORSOrigins = "CORS_ALLOWED_ORIGINS"

	envSupabaseURL    = "SUPABASE_URL"
	envSupabaseKey    = "SUPABASE_SERVICE_KEY"
	envSupabaseBucket = "SUPABASE_BUCKET"

	defaultPort    = "8080"
	defaultGinMode = "debug"

	readTimeout     = 10 * time.Second
	writeTimeout    = 30 * time.Second
	idleTimeout     = 60 * time.Second
	shutdownTimeout = 15 * time.Second

	defaultJWTIssuer   = "arogyakhosh"
	defaultCORSOrigins = "http://localhost:3000,http://localhost:5173"
	accessTokenTTL     = 15 * time.Minute

	defaultSupabaseBucket = "records"
	signedURLTTL          = 60 * time.Second
)
