ALTER TABLE accidents DROP COLUMN document_request_id;

ALTER TABLE document_requests
    ADD COLUMN accident_id uuid REFERENCES accidents (id) ON DELETE SET NULL;

CREATE INDEX document_requests_accident_idx
    ON document_requests (accident_id)
    WHERE accident_id IS NOT NULL;

ALTER TABLE accidents DROP CONSTRAINT accidents_decision_complete;
ALTER TABLE accidents DROP COLUMN decided_email;

ALTER TABLE accidents ADD COLUMN expires_at timestamptz;

ALTER TABLE accidents
    ADD CONSTRAINT accidents_decision_complete CHECK (
        status NOT IN ('confirmed', 'dismissed', 'resolved')
        OR decided_at IS NOT NULL
    );

ALTER TABLE accidents
    ADD CONSTRAINT accidents_confirmed_expires CHECK (
        status <> 'confirmed' OR expires_at IS NOT NULL
    );
