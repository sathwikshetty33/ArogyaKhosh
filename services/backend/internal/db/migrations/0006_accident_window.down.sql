ALTER TABLE accidents DROP CONSTRAINT accidents_confirmed_expires;
ALTER TABLE accidents DROP CONSTRAINT accidents_decision_complete;
ALTER TABLE accidents DROP COLUMN expires_at;

ALTER TABLE accidents ADD COLUMN decided_email text;

UPDATE accidents SET decided_email = notified_email WHERE decided_at IS NOT NULL;
UPDATE accidents SET decided_email = 'unknown' WHERE decided_at IS NOT NULL AND decided_email IS NULL;
UPDATE accidents SET status = 'notified' WHERE status = 'resolved';

ALTER TABLE accidents
    ADD CONSTRAINT accidents_decision_complete CHECK (
        status NOT IN ('confirmed', 'dismissed')
        OR (decided_at IS NOT NULL AND decided_email IS NOT NULL)
    );

DROP INDEX document_requests_accident_idx;
ALTER TABLE document_requests DROP COLUMN accident_id;

ALTER TABLE accidents
    ADD COLUMN document_request_id uuid REFERENCES document_requests (id) ON DELETE SET NULL;
