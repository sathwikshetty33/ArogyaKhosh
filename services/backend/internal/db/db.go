package db

import (
	"fmt"
	"time"

	"github.com/go-gormigrate/gormigrate/v2"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/sathwikshetty33/ArogyaKhosh/services/backend/internal/db/migrations"
)

func Open(dsn string) (*gorm.DB, error) {
	gdb, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger:         logger.Default.LogMode(logger.Warn),
		TranslateError: true,
	})
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	sqlDB, err := gdb.DB()
	if err != nil {
		return nil, fmt.Errorf("access sql handle: %w", err)
	}

	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(time.Hour)
	sqlDB.SetConnMaxIdleTime(30 * time.Minute)

	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("ping database: %w", err)
	}

	return gdb, nil
}

func migrator(gdb *gorm.DB) *gormigrate.Gormigrate {
	return gormigrate.New(gdb, gormigrate.DefaultOptions, migrations.All())
}

func Migrate(gdb *gorm.DB) error {
	if err := migrator(gdb).Migrate(); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}

	return nil
}

func RollbackLast(gdb *gorm.DB) error {
	if err := migrator(gdb).RollbackLast(); err != nil {
		return fmt.Errorf("rollback: %w", err)
	}

	return nil
}
