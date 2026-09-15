package migrations

import (
	"embed"
	"fmt"

	"github.com/go-gormigrate/gormigrate/v2"
	"gorm.io/gorm"
)

//go:embed *.sql
var files embed.FS

func All() []*gormigrate.Migration {
	return []*gormigrate.Migration{
		sqlMigration("0001_init"),
		sqlMigration("0002_uuid_keys"),
		sqlMigration("0003_accidents"),
		sqlMigration("0004_accident_approval_key"),
	}
}

func sqlMigration(id string) *gormigrate.Migration {
	return &gormigrate.Migration{
		ID: id,
		Migrate: func(tx *gorm.DB) error {
			return exec(tx, id+".up.sql")
		},
		Rollback: func(tx *gorm.DB) error {
			return exec(tx, id+".down.sql")
		},
	}
}

func exec(tx *gorm.DB, name string) error {
	body, err := files.ReadFile(name)
	if err != nil {
		return fmt.Errorf("read %s: %w", name, err)
	}

	if err := tx.Exec(string(body)).Error; err != nil {
		return fmt.Errorf("exec %s: %w", name, err)
	}

	return nil
}
