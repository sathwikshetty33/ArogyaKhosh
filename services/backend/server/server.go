package server

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/auth"
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

	patients := v1.Group("/patients", s.requireAuth())
	patients.GET("/:id", s.getPatient)
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

	c.JSON(http.StatusOK, gin.H{"status": "ready", "database": "up"})
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
