#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/tools/creds.json"
cd "$ROOT"

from_env() {
  local key=$1 fallback=$2 value=""
  [ -f "$ROOT/.env" ] && value=$(sed -n "s/^$key=//p" "$ROOT/.env" | tail -1 | tr -d '\r')
  printf '%s' "${value:-$fallback}"
}

FRONTEND_PORT=$(from_env FRONTEND_PORT 3000)
BACKEND_PORT=$(from_env BACKEND_PORT 8080)
POSTGRES_PORT=$(from_env POSTGRES_PORT 5433)
RABBITMQ_UI_PORT=$(from_env RABBITMQ_UI_PORT 15673)
AI_PORT=$(from_env AI_PORT 50051)
POSTGRES_DB=$(from_env POSTGRES_DB arogyakhosh)
POSTGRES_USER=$(from_env POSTGRES_USER arogya)
POSTGRES_PASSWORD=$(from_env POSTGRES_PASSWORD arogya)
RABBITMQ_USER=$(from_env RABBITMQ_USER arogya)
RABBITMQ_PASSWORD=$(from_env RABBITMQ_PASSWORD arogya)

API="${API:-http://localhost:$BACKEND_PORT}"
APP="${APP:-http://localhost:$FRONTEND_PORT}"
PASSWORD="${DEMO_PASSWORD:-arogya-demo-2026}"

COMPOSE="docker compose"
PSQL="$COMPOSE exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB"

say() { printf '  %s\n' "$*"; }

require() {
  command -v "$1" >/dev/null 2>&1 || { echo "provision needs $1 on PATH" >&2; exit 1; }
}

require curl
require jq
require docker

api() {
  local method=$1 path=$2 body=${3:-} token=${4:-}
  local args=(-s -X "$method" "$API$path")
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$body" ] && args+=(-H 'Content-Type: application/json' -d "$body")
  curl "${args[@]}"
}

start_services() {
  if [ "${SKIP_COMPOSE:-0}" = "1" ]; then
    say "skipping docker compose, using what is already running"
    return
  fi

  say "starting services"
  $COMPOSE up -d --build >/dev/null 2>&1 || $COMPOSE up -d --build
}

wait_for_api() {
  say "waiting for $API"
  for _ in $(seq 1 60); do
    if curl -sf "$API/readyz" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "the api never became ready; is 'docker compose up' running?" >&2
  exit 1
}

reset_demo_accounts() {
  say "removing any previous demo accounts"
  $PSQL -qc "DELETE FROM users WHERE username IN ('sathwik','anitarao','vikrammenon','drtest');" >/dev/null
}

ensure_hospital() {
  local name=$1 city=$2
  $PSQL -tAc "INSERT INTO hospitals (name, city)
              SELECT '$name', '$city'
              WHERE NOT EXISTS (SELECT 1 FROM hospitals WHERE name = '$name');" >/dev/null
  $PSQL -tAc "SELECT id FROM hospitals WHERE name = '$name' LIMIT 1;" | tr -d '[:space:]'
}

register_patient() {
  api POST /api/v1/auth/register/patient "$(jq -nc \
    --arg p "$PASSWORD" '{
      username: "sathwik",
      full_name: "Sathwik Shetty",
      email: "sathwik@example.com",
      password: $p,
      blood_group: "O+",
      height_cm: 175.5,
      weight_kg: 70.2,
      emergency_contact_email: "amma@example.com"
    }')"
}

upload_documents() {
  local patient_id=$1 token=$2 tmp results
  tmp=$(mktemp -d)
  results="[]"

  upload_one() {
    local name=$1 visibility=$2 body=$3 file="$tmp/$1.txt"
    printf '%s\n' "$body" > "$file"
    curl -s -X POST "$API/api/v1/patients/$patient_id/documents" \
      -H "Authorization: Bearer $token" \
      -F "file=@$file" -F "name=$name" -F "visibility=$visibility"
  }

  results=$(jq -nc \
    --argjson a "$(upload_one 'Vaccination card' public 'ArogyaKhosh demo. Immunisation history. Not a real medical record.')" \
    --argjson b "$(upload_one 'Cardiology report 2026' private 'ArogyaKhosh demo. ECG and echo summary. Not a real medical record.')" \
    --argjson c "$(upload_one 'Discharge summary' private 'ArogyaKhosh demo. Admission and discharge notes. Not a real medical record.')" \
    '[$a, $b, $c] | map(select(type == "object"))')

  rm -rf "$tmp"
  printf '%s' "$results"
}

register_doctor() {
  local username=$1 full=$2 email=$3 hospital=$4 qualification=$5 position=$6
  api POST /api/v1/auth/register/doctor "$(jq -nc \
    --arg u "$username" --arg f "$full" --arg e "$email" --arg p "$PASSWORD" \
    --arg h "$hospital" --arg q "$qualification" --arg pos "$position" '{
      username: $u, full_name: $f, email: $e, password: $p,
      hospital_id: $h, qualification: $q, position: $pos
    }')"
}

summary() {
  local patient_id=$1
  local bar="────────────────────────────────────────────────────────────"

  cat <<BANNER

$bar
  ArogyaKhosh is running
$bar

  App                $APP
  API                $API
  Health             $API/readyz
  RabbitMQ UI        http://localhost:$RABBITMQ_UI_PORT   ($RABBITMQ_USER / $RABBITMQ_PASSWORD)
  Postgres           localhost:$POSTGRES_PORT   ($POSTGRES_DB / $POSTGRES_USER / $POSTGRES_PASSWORD)
  Model service      localhost:$AI_PORT   (gRPC)

$bar
  Demo accounts            password for all:  $PASSWORD
$bar

  PATIENT
    username         sathwik
    email            sathwik@example.com
    dashboard        $APP/patients/$patient_id
    manage access    $APP/patients/$patient_id/access
    emergency page   $APP/report/$patient_id

  DOCTORS
    anitarao         granted     sees every document, expires in 48 hours
    vikrammenon      pending     waiting on the patient to approve
    drtest           declined    sees public documents only

$bar
  Sign in at $APP as sathwik / $PASSWORD
  Full details in tools/creds.json
$bar

BANNER
}

main() {
  start_services
  wait_for_api
  reset_demo_accounts

  say "creating hospitals"
  local apollo manipal
  apollo=$(ensure_hospital "Apollo Bengaluru" "Bengaluru")
  manipal=$(ensure_hospital "Manipal Hospital" "Bengaluru")

  say "creating the patient"
  local patient_json patient_token patient_id
  patient_json=$(register_patient)
  patient_token=$(jq -r '.token' <<<"$patient_json")
  patient_id=$(jq -r '.profile.id' <<<"$patient_json")
  [ "$patient_token" != "null" ] || { echo "patient registration failed: $patient_json" >&2; exit 1; }

  say "creating doctors"
  local anita_json vikram_json drtest_json
  anita_json=$(register_doctor anitarao "Dr Anita Rao" anita.rao@example.com "$apollo" "MBBS, MD (Cardiology)" "Consultant")
  vikram_json=$(register_doctor vikrammenon "Dr Vikram Menon" vikram.menon@example.com "$apollo" "MBBS, MS (Ortho)" "Registrar")
  drtest_json=$(register_doctor drtest "Dr Test Decline" dtest@example.com "$apollo" "MBBS" "")

  local anita_token vikram_token drtest_token
  anita_token=$(jq -r '.token' <<<"$anita_json")
  vikram_token=$(jq -r '.token' <<<"$vikram_json")
  drtest_token=$(jq -r '.token' <<<"$drtest_json")

  say "putting each doctor at a different point of the access flow"
  local anita_request drtest_request
  anita_request=$(api POST "/api/v1/patients/$patient_id/requests" "" "$anita_token" | jq -r '.id')
  api POST "/api/v1/patients/$patient_id/requests" "" "$vikram_token" >/dev/null
  drtest_request=$(api POST "/api/v1/patients/$patient_id/requests" "" "$drtest_token" | jq -r '.id')

  api POST "/api/v1/requests/$anita_request/approve" '{"expires_in_hours":48}' "$patient_token" >/dev/null
  api POST "/api/v1/requests/$drtest_request/decline" "" "$patient_token" >/dev/null

  say "uploading documents"
  local docs
  docs=$(upload_documents "$patient_id" "$patient_token")

  jq -n \
    --arg password "$PASSWORD" --arg app "$APP" --arg api "$API" \
    --arg patient_id "$patient_id" \
    --arg apollo "$apollo" --arg manipal "$manipal" \
    --argjson docs "${docs:-[]}" '
    {
      note: "Local demo accounts created by tools/provision.sh. Regenerate with: make provision",
      password: $password,
      urls: {
        app: $app,
        api: $api,
        record: "\($app)/patients/\($patient_id)",
        access: "\($app)/patients/\($patient_id)/access",
        emergency_report: "\($app)/report/\($patient_id)"
      },
      patient: {
        username: "sathwik",
        email: "sathwik@example.com",
        id: $patient_id,
        blood_group: "O+",
        height_cm: 175.5,
        weight_kg: 70.2,
        emergency_contact: "amma@example.com"
      },
      doctors: [
        { username: "anitarao",    email: "anita.rao@example.com",    hospital: "Apollo Bengaluru", access: "granted",  note: "sees every document, expires in 48 hours" },
        { username: "vikrammenon", email: "vikram.menon@example.com", hospital: "Apollo Bengaluru", access: "pending",  note: "waiting on the patient to approve" },
        { username: "drtest",      email: "dtest@example.com",        hospital: "Apollo Bengaluru", access: "declined", note: "sees public documents only" }
      ],
      hospitals: { "Apollo Bengaluru": $apollo, "Manipal Hospital": $manipal },
      documents: $docs
    }' > "$OUT"

  summary "$patient_id"
}

main "$@"
