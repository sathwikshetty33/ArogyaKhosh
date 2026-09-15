package server

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/auth"
	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/storage"
)

type Config struct {
	Port            string
	Mode            string
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	IdleTimeout     time.Duration
	ShutdownTimeout time.Duration
	DB              *gorm.DB
	JWT             *utils.JWTManager
	AllowedOrigins  []string
	Storage         storage.Provider
	SignedURLTTL    time.Duration
}

type Server struct {
	cfg    Config
	engine *gin.Engine
	http   *http.Server
}

func New(cfg Config) *Server {
	gin.SetMode(cfg.Mode)

	engine := gin.New()
	engine.Use(gin.Logger(), gin.Recovery())

	allowed := make(map[string]struct{}, len(cfg.AllowedOrigins))
	for _, origin := range cfg.AllowedOrigins {
		allowed[origin] = struct{}{}
	}

	engine.Use(cors.New(cors.Config{
		AllowOriginWithContextFunc: func(c *gin.Context, origin string) bool {
			if _, ok := allowed[origin]; ok {
				return true
			}

			return sameOrigin(c.Request, origin)
		},
		AllowMethods:     []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	s := &Server{cfg: cfg, engine: engine}
	s.registerRoutes()

	s.http = &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      engine,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
		IdleTimeout:  cfg.IdleTimeout,
	}

	return s
}

func sameOrigin(request *http.Request, origin string) bool {
	parsed, err := url.Parse(origin)
	if err != nil {
		return false
	}

	return parsed.Host != "" && parsed.Host == request.Host
}

func (s *Server) Engine() *gin.Engine {
	return s.engine
}

func (s *Server) registerRoutes() {
	s.engine.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	s.engine.GET("/readyz", s.ready)

	v1 := s.engine.Group("/api/v1")
	v1.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "pong"})
	})

	auth := v1.Group("/auth")
	auth.POST("/register/patient", s.registerPatient)
	auth.POST("/register/doctor", s.registerDoctor)
	auth.POST("/login", s.login)

	v1.GET("/me", s.requireAuth(), s.getMe)

	patients := v1.Group("/patients", s.requireAuth())
	patients.GET("/:id", s.getPatient)
	patients.PATCH("/:id", s.updatePatient)
	patients.POST("/:id/documents", s.uploadDocument)
	patients.POST("/:id/requests", s.createAccessRequest)
	patients.GET("/:id/requests", s.listAccessRequests)

	requests := v1.Group("/requests", s.requireAuth())
	requests.POST("/:id/approve", s.approveAccessRequest)
	requests.POST("/:id/decline", s.declineAccessRequest)
	requests.POST("/:id/revoke", s.revokeAccessRequest)

	documents := v1.Group("/documents", s.requireAuth())
	documents.GET("/:id/url", s.documentURL)
	documents.PATCH("/:id", s.updateDocument)
	documents.DELETE("/:id", s.deleteDocument)
}

func (s *Server) ready(c *gin.Context) {
	sqlDB, err := s.cfg.DB.DB()
	if err != nil {
		c.Error(err)
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unavailable", "database": "down"})
		return
	}

	if err := sqlDB.PingContext(c.Request.Context()); err != nil {
		c.Error(err)
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unavailable", "database": "down"})
		return
	}

	store := "not configured"
	if s.cfg.Storage != nil {
		store = "configured"
	}

	c.JSON(http.StatusOK, gin.H{"status": "ready", "database": "up", "storage": store})
}

func (s *Server) Run() error {
	errCh := make(chan error, 1)

	go func() {
		if err := s.http.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-errCh:
		return err
	case <-quit:
	}

	ctx, cancel := context.WithTimeout(context.Background(), s.cfg.ShutdownTimeout)
	defer cancel()

	return s.http.Shutdown(ctx)
}
