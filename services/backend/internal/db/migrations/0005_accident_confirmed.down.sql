DROP INDEX accidents_open_idx;

CREATE INDEX accidents_open_idx
    ON accidents (created_at DESC)
    WHERE status IN ('reported', 'notified');

ALTER TABLE accidents DROP CONSTRAINT accidents_decision_complete;

ALTER TABLE accidents
    DROP COLUMN decided_at,
    DROP COLUMN decided_email;

UPDATE accidents SET status = 'notified' WHERE status = 'confirmed';

ALTER TABLE accidents DROP CONSTRAINT accidents_status_valid;

ALTER TABLE accidents
    ADD CONSTRAINT accidents_status_valid
    CHECK (status IN ('reported', 'notified', 'dismissed', 'resolved'));
