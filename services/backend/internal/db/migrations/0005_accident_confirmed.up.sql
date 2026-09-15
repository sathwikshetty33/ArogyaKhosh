ALTER TABLE accidents DROP CONSTRAINT accidents_status_valid;

ALTER TABLE accidents
    ADD CONSTRAINT accidents_status_valid
    CHECK (status IN ('reported', 'notified', 'confirmed', 'dismissed', 'resolved'));

ALTER TABLE accidents
    ADD COLUMN decided_at    timestamptz,
    ADD COLUMN decided_email text;

ALTER TABLE accidents
    ADD CONSTRAINT accidents_decision_complete CHECK (
        status NOT IN ('confirmed', 'dismissed')
        OR (decided_at IS NOT NULL AND decided_email IS NOT NULL)
    );

DROP INDEX accidents_open_idx;

CREATE INDEX accidents_open_idx
    ON accidents (patient_id, created_at DESC)
    WHERE status = 'confirmed';
