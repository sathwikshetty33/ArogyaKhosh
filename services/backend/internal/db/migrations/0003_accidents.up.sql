CREATE TABLE accidents (
    id         uuid PRIMARY KEY DEFAULT uuidv7(),
    patient_id uuid NOT NULL REFERENCES patients (id) ON DELETE CASCADE,

    status text NOT NULL DEFAULT 'reported'
        CONSTRAINT accidents_status_valid
        CHECK (status IN ('reported', 'notified', 'dismissed', 'resolved')),

    photo_key          text,
    photo_content_type text,
    photo_size_bytes   bigint CONSTRAINT accidents_photo_size_non_negative CHECK (photo_size_bytes >= 0),

    model_name      text,
    model_threshold numeric(6, 5) CONSTRAINT accidents_threshold_range CHECK (model_threshold BETWEEN 0 AND 1),
    confidence      numeric(6, 5) CONSTRAINT accidents_confidence_range CHECK (confidence BETWEEN 0 AND 1),
    model_verdict   boolean,

    reporter_ip text,
    latitude    numeric(9, 6) CONSTRAINT accidents_latitude_range CHECK (latitude BETWEEN -90 AND 90),
    longitude   numeric(9, 6) CONSTRAINT accidents_longitude_range CHECK (longitude BETWEEN -180 AND 180),

    notified_at    timestamptz,
    notified_email text,

    document_request_id uuid REFERENCES document_requests (id) ON DELETE SET NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT accidents_notified_complete CHECK (
        status <> 'notified'
        OR (notified_at IS NOT NULL AND notified_email IS NOT NULL)
    ),

    CONSTRAINT accidents_photo_complete CHECK (
        (photo_key IS NULL AND photo_size_bytes IS NULL)
        OR photo_key IS NOT NULL
    ),

    CONSTRAINT accidents_score_complete CHECK (
        model_verdict IS NULL
        OR (confidence IS NOT NULL AND model_threshold IS NOT NULL AND model_name IS NOT NULL)
    )
);

CREATE UNIQUE INDEX accidents_photo_key ON accidents (photo_key) WHERE photo_key IS NOT NULL;
CREATE INDEX accidents_patient_idx ON accidents (patient_id, created_at DESC);
CREATE INDEX accidents_open_idx ON accidents (created_at DESC) WHERE status IN ('reported', 'notified');

CREATE TRIGGER accidents_set_updated_at
    BEFORE UPDATE ON accidents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
