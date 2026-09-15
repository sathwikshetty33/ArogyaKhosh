DROP INDEX IF EXISTS accidents_approval_key_hash;

ALTER TABLE accidents
    DROP CONSTRAINT IF EXISTS accidents_approval_key_complete,
    DROP CONSTRAINT IF EXISTS accidents_approval_used_needs_key;

ALTER TABLE accidents
    DROP COLUMN IF EXISTS approval_key_hash,
    DROP COLUMN IF EXISTS approval_key_expires_at,
    DROP COLUMN IF EXISTS approval_used_at;
