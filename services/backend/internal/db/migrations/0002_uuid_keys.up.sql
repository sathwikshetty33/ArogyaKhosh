DROP TABLE IF EXISTS document_requests;
DROP TABLE IF EXISTS patient_documents;
DROP TABLE IF EXISTS doctors;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS hospitals;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id            uuid PRIMARY KEY DEFAULT uuidv7(),
    username      text NOT NULL,
    full_name     text NOT NULL,
    email         text NOT NULL,
    password_hash text NOT NULL,
    role          text NOT NULL CONSTRAINT users_role_valid CHECK (role IN ('patient', 'doctor', 'admin')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_username_key ON users (lower(username));
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TABLE hospitals (
    id            uuid PRIMARY KEY DEFAULT uuidv7(),
    name          text NOT NULL,
    license       text,
    address       text,
    city          text,
    contact_email text,
    contact_phone text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX hospitals_license_key ON hospitals (lower(license)) WHERE license IS NOT NULL;
CREATE INDEX hospitals_name_idx ON hospitals (lower(name));

CREATE TABLE patients (
    id                      uuid PRIMARY KEY DEFAULT uuidv7(),
    user_id                 uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    blood_group             text CONSTRAINT patients_blood_group_valid CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    height_cm               numeric(5, 2) CONSTRAINT patients_height_positive CHECK (height_cm > 0),
    weight_kg               numeric(5, 2) CONSTRAINT patients_weight_positive CHECK (weight_kg > 0),
    emergency_contact_email text,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX patients_user_key ON patients (user_id);

CREATE TABLE doctors (
    id            uuid PRIMARY KEY DEFAULT uuidv7(),
    user_id       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    hospital_id   uuid NOT NULL REFERENCES hospitals (id) ON DELETE RESTRICT,
    qualification text NOT NULL,
    position      text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX doctors_user_key ON doctors (user_id);
CREATE INDEX doctors_hospital_idx ON doctors (hospital_id);

CREATE TABLE patient_documents (
    id           uuid PRIMARY KEY DEFAULT uuidv7(),
    patient_id   uuid NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
    name         text NOT NULL,
    storage_key  text NOT NULL,
    visibility   text NOT NULL DEFAULT 'private' CONSTRAINT patient_documents_visibility_valid CHECK (visibility IN ('public', 'private')),
    content_type text,
    size_bytes   bigint CONSTRAINT patient_documents_size_non_negative CHECK (size_bytes >= 0),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX patient_documents_storage_key ON patient_documents (storage_key);
CREATE INDEX patient_documents_patient_idx ON patient_documents (patient_id, created_at DESC);

CREATE TABLE document_requests (
    id               uuid PRIMARY KEY DEFAULT uuidv7(),
    patient_id       uuid NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
    doctor_id        uuid NOT NULL REFERENCES doctors (id) ON DELETE CASCADE,
    status           text NOT NULL DEFAULT 'pending' CONSTRAINT document_requests_status_valid CHECK (status IN ('pending', 'granted', 'declined', 'revoked')),
    granted_by_email text,
    granted_at       timestamptz,
    expires_at       timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT document_requests_grant_complete CHECK (
        status <> 'granted'
        OR (granted_by_email IS NOT NULL AND granted_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX document_requests_single_pending_idx
    ON document_requests (patient_id, doctor_id)
    WHERE status = 'pending';

CREATE INDEX document_requests_grantee_idx
    ON document_requests (doctor_id, patient_id)
    WHERE status = 'granted';

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER hospitals_set_updated_at
    BEFORE UPDATE ON hospitals
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER patients_set_updated_at
    BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER doctors_set_updated_at
    BEFORE UPDATE ON doctors
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER patient_documents_set_updated_at
    BEFORE UPDATE ON patient_documents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER document_requests_set_updated_at
    BEFORE UPDATE ON document_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
