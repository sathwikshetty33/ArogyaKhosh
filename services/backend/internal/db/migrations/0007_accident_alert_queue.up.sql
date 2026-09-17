ALTER TABLE accidents ADD COLUMN alert_queued_at timestamptz;

UPDATE accidents SET alert_queued_at = notified_at WHERE notified_at IS NOT NULL;

CREATE INDEX accidents_alert_stranded_idx
    ON accidents (created_at)
    WHERE status = 'reported' AND alert_queued_at IS NULL;
