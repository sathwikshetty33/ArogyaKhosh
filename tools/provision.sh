#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPEC="$ROOT/tools/creds.json"
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
PASSWORD="${DEMO_PASSWORD:-$(jq -r .password "$ROOT/tools/creds.json")}"

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

spec() { jq -r "$1" "$SPEC"; }

reset_demo_accounts() {
  say "removing any previous demo accounts"
  local names
  names=$(spec '[.patient.username] + [.doctors[].username] | map("'"'"'" + . + "'"'"'") | join(",")')
  $PSQL -qc "DELETE FROM users WHERE username IN ($names);" >/dev/null
}

ensure_hospital() {
  local name=$1 city=$2
  $PSQL -tAc "INSERT INTO hospitals (name, city)
              SELECT '$name', '$city'
              WHERE NOT EXISTS (SELECT 1 FROM hospitals WHERE name = '$name');" >/dev/null
  $PSQL -tAc "SELECT id FROM hospitals WHERE name = '$name' LIMIT 1;" | tr -d '[:space:]'
}

register_patient() {
  api POST /api/v1/auth/register/patient \
    "$(jq -c --arg p "$PASSWORD" '.patient + {password: $p}' "$SPEC")"
}

upload_documents() {
  local patient_id=$1 token=$2 tmp count
  tmp=$(mktemp -d)
  count=$(spec '.documents | length')

  for i in $(seq 0 $((count - 1))); do
    local name visibility body file
    name=$(spec ".documents[$i].name")
    visibility=$(spec ".documents[$i].visibility")
    body=$(spec ".documents[$i].body")
    file="$tmp/doc$i.txt"
    printf '%s\n' "$body" > "$file"

    curl -s -X POST "$API/api/v1/patients/$patient_id/documents" \
      -H "Authorization: Bearer $token" \
      -F "file=@$file" -F "name=$name" -F "visibility=$visibility" >/dev/null
  done

  rm -rf "$tmp"
  say "uploaded $count documents"
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
$(jq -r '.doctors[] | "    \(.username | . + (" " * (17 - length)))\(.access | . + (" " * (12 - length)))\(.note)"' "$SPEC")

$bar
  Sign in at $APP as sathwik / $PASSWORD
  Accounts are defined in tools/creds.json
$bar

BANNER
}

show_only() {
  local token patient_id
  token=$(api POST /api/v1/auth/login \
    "$(jq -c --arg p "$PASSWORD" '{identifier: .patient.username, password: $p}' "$SPEC")" | jq -r '.token')

  if [ "$token" = "null" ] || [ -z "$token" ]; then
    echo "cannot reach $API or the demo accounts do not exist yet; run 'make provision'" >&2
    exit 1
  fi

  patient_id=$(api GET /api/v1/me "" "$token" | jq -r '.patient.id')
  summary "$patient_id"
}

main() {
  if [ "${1:-}" = "--show" ]; then
    show_only
    return
  fi

  start_services
  wait_for_api
  reset_demo_accounts

  say "creating hospitals"
  local hospital_count
  hospital_count=$(spec '.hospitals | length')
  for i in $(seq 0 $((hospital_count - 1))); do
    ensure_hospital "$(spec ".hospitals[$i].name")" "$(spec ".hospitals[$i].city")" >/dev/null
  done

  say "creating the patient"
  local patient_json patient_token patient_id
  patient_json=$(register_patient)
  patient_token=$(jq -r '.token' <<<"$patient_json")
  patient_id=$(jq -r '.profile.id' <<<"$patient_json")
  [ "$patient_token" != "null" ] || { echo "patient registration failed: $patient_json" >&2; exit 1; }

  say "creating doctors"
  local doctor_count
  doctor_count=$(spec '.doctors | length')

  for i in $(seq 0 $((doctor_count - 1))); do
    local username hospital_name hospital_id doctor_json token access request_id
    username=$(spec ".doctors[$i].username")
    hospital_name=$(spec ".doctors[$i].hospital")
    hospital_id=$(ensure_hospital "$hospital_name" "$(spec ".hospitals[] | select(.name == \"$hospital_name\") | .city")")

    doctor_json=$(api POST /api/v1/auth/register/doctor \
      "$(jq -c --arg p "$PASSWORD" --arg h "$hospital_id" --argjson i "$i" \
         '.doctors[$i] | {username, full_name, email, qualification, position} + {password: $p, hospital_id: $h}' "$SPEC")")

    token=$(jq -r '.token' <<<"$doctor_json")
    [ "$token" != "null" ] || { echo "registering $username failed: $doctor_json" >&2; exit 1; }

    access=$(spec ".doctors[$i].access")
    request_id=$(api POST "/api/v1/patients/$patient_id/requests" "" "$token" | jq -r '.id')

    case "$access" in
      granted)
        local hours
        hours=$(spec ".doctors[$i].expires_in_hours // 48")
        api POST "/api/v1/requests/$request_id/approve" "{\"expires_in_hours\":$hours}" "$patient_token" >/dev/null
        ;;
      declined)
        api POST "/api/v1/requests/$request_id/decline" "" "$patient_token" >/dev/null
        ;;
    esac

    say "  $username -> $access"
  done

  say "uploading documents"
  upload_documents "$patient_id" "$patient_token"

  summary "$patient_id"
}

main "$@"
