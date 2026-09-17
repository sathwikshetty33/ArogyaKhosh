DROP INDEX accidents_alert_stranded_idx;

ALTER TABLE accidents DROP COLUMN alert_queued_at;
