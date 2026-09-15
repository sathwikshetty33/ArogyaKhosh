ALTER TABLE accidents
    ADD COLUMN approval_key_hash       text,
    ADD COLUMN approval_key_expires_at timestamptz,
    ADD COLUMN approval_used_at        timestamptz;

CREATE UNIQUE INDEX accidents_approval_key_hash
    ON accidents (approval_key_hash)
    WHERE approval_key_hash IS NOT NULL;

ALTER TABLE accidents
    ADD CONSTRAINT accidents_approval_key_complete CHECK (
        (approval_key_hash IS NULL AND approval_key_expires_at IS NULL)
        OR (approval_key_hash IS NOT NULL AND approval_key_expires_at IS NOT NULL)
    );

ALTER TABLE accidents
    ADD CONSTRAINT accidents_approval_used_needs_key CHECK (
        approval_used_at IS NULL OR approval_key_hash IS NOT NULL
    );
