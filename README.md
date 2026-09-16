<p align="center">
  <img src="assets/logo.svg" alt="ArogyaKhosh" width="84" height="84">
</p>

<h1 align="center">ArogyaKhosh</h1>

<p align="center">
  Medical records with a consent model built for the moment the patient cannot speak.
</p>

A medical records system built around one uncomfortable question: if you are
unconscious at the side of a road, who is allowed to open your file?

Most health record systems answer that by never asking it. They assume the
patient is awake, at a keyboard, able to tick a box. ArogyaKhosh assumes the
opposite case is the one that matters, and builds the consent machinery around
a person who cannot speak for themselves.

You carry a card with a QR code. A stranger scans it. They cannot see a single
thing about you. What they can do is send a photo of what they are looking at,
which alerts whoever you listed as your emergency contact. From that point,
until the window closes, that contact can answer for you when a doctor asks to
read your chart.

That is the whole idea. Everything below is what it took to make it not leak.

## Table of contents

- [What it does](#what-it-does)
- [How the accident flow actually works](#how-the-accident-flow-actually-works)
- [Architecture](#architecture)
- [The data model](#the-data-model)
- [Choosing the model](#choosing-the-model)
- [What the model is worth right now](#what-the-model-is-worth-right-now)
- [Security decisions](#security-decisions)
- [Running it](#running-it)
- [API](#api)
- [Project layout](#project-layout)
- [License](#license)

## What it does

For a patient:

- Keep medical documents in one place, each marked public or private
- Approve, decline and revoke a named doctor's access, any time
- Carry a printable emergency card with a QR code on it
- See every accident reported against them, who was told, and every doctor who
  got in because of it

For a doctor:

- Search for a patient by exact username or email
- Request access, and see where every request of theirs stands
- Read what they have been granted, and only that

For whoever finds you:

- Scan, photograph, send. No account, no login, no sight of your records.

## How the accident flow actually works

The QR is static. It never changes and it encodes nothing secret, just
`/report/<patient-id>`. That is deliberate. The person scanning it is not you,
so anything requiring your phone, your key or your session is useless in the
only situation the card exists for.

```
  stranger scans the card
           |
           v
  POST /accidents/:id  ........  photo optional, location optional
           |
           |-- photo goes to object storage
           |-- photo goes to the model, which returns a score
           |-- a random key is generated, only its hash is stored
           v
  email to the emergency contact  ......  /accept/<accident-id>/<key>
           |
           v
  contact opens it, sees the photo, decides
           |
           |-- "false alarm"     -> report dismissed, any access it opened is pulled
           |-- "this is real"    -> report confirmed, window extended to 7 days
           |
           v
  a doctor asks for the records
           |
           v
  email to the contact  ......  /grant-access/<signed-token>
           |
           v
  contact says yes -> the doctor is in, until the report closes
```

A few things in there are load bearing.

**A photo is optional.** Someone struck by a car that drove off leaves nothing
to photograph. The alert still goes out, marked unscored.

**The model never gates anything.** If it is down, refuses the image, or is not
configured at all, the report is still saved and the contact is still told. It
sorts, it does not decide. A model that can block an ambulance call is a worse
system than no model.

**A report authorises before it is confirmed.** A doctor standing over an
unconscious patient cannot wait for someone to check their inbox. So an
unconfirmed report already diverts requests to the contact. Because that runs
on a stranger's word alone, it gets a shorter leash: one day, the same span as
the approval link. Confirming extends it to a week.

**Every window closes.** A report carries an expiry. Access granted through it
expires with it. The contact can dismiss or close early, and the patient has a
"stop asking my contact" button that shuts it immediately. Expiry is evaluated
when a request is read, never by a background sweeper, so a lapsed window can
never be used because a job was running late.

**Dismiss and close are different things.** Dismiss means the report was wrong,
so the access it opened was never warranted and gets revoked. Close means the
episode is over, and those doctors really did treat the patient, so their
grants stand as history for the patient to withdraw on their own terms.

## Architecture

Three services, and a hard line between them.

```
  React (Vite, Tailwind)
        |
        |  HTTP, proxied in dev so there is no CORS to configure
        v
  Go + Gin  ..............  owns all state
        |                   auth, RBAC, CRUD, object storage, mail
        |
        +--> PostgreSQL 18        the only source of truth
        +--> Supabase Storage     document and photo bytes, private bucket
        +--> SMTP                 the two emails the flow depends on
        |
        |  gRPC
        v
  Python  ................  owns no state
                            CLIP + a linear head, and nothing else
```

The Python service has no database connection, no credentials, and no route to
the internet. It takes image bytes and returns three numbers. That is the whole
contract, and it is the reason a model with a dependency tree the size of
PyTorch is not also a path into the records.

Go owns everything that persists. That keeps authorisation in one language, in
one process, behind one function.

## The data model

Eight tables. The interesting parts are the constraints, not the columns.

| Table | What it holds |
|---|---|
| `users` | account, name, email, password hash, role |
| `patients` | blood group, height, weight, emergency contact email |
| `doctors` | hospital, qualification, position |
| `hospitals` | name, city |
| `patient_documents` | storage key, display name, public or private |
| `document_requests` | a doctor asking for a patient's records |
| `accidents` | a report, its photo, its score, its window |
| `migrations` | applied migration ids |

Every primary key is a `uuid` defaulting to Postgres 18's native `uuidv7()`.
Version 7 keeps them time ordered, so they behave like sequential ids in an
index while still being safe to put in a URL.

Consent lives in `document_requests` and is expressed as something a database
can check:

```sql
status = 'granted' AND (expires_at IS NULL OR expires_at > now())
```

That predicate is the whole authorisation rule. It is deliberately shaped like
a `WHERE` clause so it can become a row level security policy later without
rewriting the application.

`document_requests.accident_id` records which report a request came in under,
if any. That column exists because of a bug. Revocation used to match on
timestamps, "anything granted after the accident started", which also caught
grants the patient made themselves, from their own dashboard, for unrelated
follow-ups. Linking the request to the accident turned a heuristic into a fact.

Schema changes are versioned SQL files run by gormigrate. GORM's `AutoMigrate`
is never used. It cannot express a partial unique index or a check constraint,
and this schema leans on both.

## Choosing the model

### What the job actually is

One bit: does this photograph show a road accident. Not where the cars are, not
how many, not how badly hurt anyone is. A bystander is holding a phone in one
hand and possibly holding someone's head still with the other. The output is a
single number that decides whether an email sounds urgent, and a human reads
that email either way.

Getting the question that small is most of the decision. It rules out anything
that localises, counts or describes, because none of that is asked for.

### What I chose: CLIP features with a linear head

Take OpenAI's CLIP vision encoder, freeze it completely, and use it only to turn
a picture into 512 numbers. Then fit plain logistic regression on top of those
numbers. That is it. Inference is one forward pass through CLIP, one dot
product, one sigmoid.

CLIP earns its place because of what it was trained on: hundreds of millions of
image and text pairs scraped from the open web. Somewhere in that haul are a
great many photographs of crashes, crumpled bonnets, emergency vehicles and
debris on tarmac, each sitting next to a caption describing it. So the encoder
already separates those scenes from ordinary traffic before this project starts.
Nobody has to teach it what a wreck looks like. It only has to be asked.

That leaves a genuinely easy remaining problem. Drawing one boundary through a
512 dimensional space where the hard visual work is already done needs very
little data and no gradient ever flowing back into CLIP itself. A few thousand
labelled images is plenty, which matters enormously here, because a few thousand
was realistically all I was going to get.

The trained model is 513 numbers, and they are the whole thing:

```json
{
  "clip_model": "openai/clip-vit-base-patch32",
  "embedding_dim": 512,
  "weights": [ ...512 floats... ],
  "bias": 0.7905284925508785,
  "threshold": 0.6466099724683639
}
```

Four things that buys, in rough order of how much they mattered:

- **It trains on a laptop in minutes.** No GPU, no fine tuning run, no
  augmentation pipeline. Retraining after a data fix costs a coffee, not an
  afternoon, and the model is going to need retraining.
- **It cannot hide a bad dataset.** A linear head on frozen features has
  nowhere near the capacity to memorise its way to a good score. So when the
  metrics came back perfect, that was information rather than success. A
  fine tuned network would have absorbed the same flaw and looked merely very
  good, which is far harder to catch.
- **The artifact is readable.** It is JSON. Two versions of the model diff in a
  text editor, and the threshold is a number sitting in the file rather than
  something baked into a binary blob.
- **It runs on CPU and never phones home.** The container installs a CPU only
  build of PyTorch and bakes the CLIP weights in with `HF_HUB_OFFLINE=1` set.
  It is still a large image, around 3.7 GB, and almost all of that is PyTorch
  rather than anything this project trained.

The threshold is tuned for 95 percent recall, not best accuracy. A false
positive here sends an email that a person then looks at and dismisses. A false
negative means nobody is told at all. Those two costs are nowhere near equal, so
the operating point leans hard towards catching things.

### Why not the alternatives

- **YOLOv8, or object detection generally.** It answers "there is a car, here",
  and a car being present is not an accident. Bridging boxes to "this is a
  crash" needs bounding box labels on thousands of images plus handwritten rules
  over the boxes that are guesswork anyway.
- **Fine tuning a ResNet or EfficientNet.** It would probably work, and it costs
  a GPU, thousands of well balanced images and a repeatable training run, all to
  buy a decision boundary in a feature space CLIP already hands over for free.
- **CLIP zero shot, with text prompts and no head at all.** Tempting, since it
  needs no training data, but the score then swings on prompt wording and there
  is no honest way to tune an operating point for recall.
- **A hosted vision model behind an API.** Per call cost, a third party seeing
  photographs of injured people, and a network dependency on the one code path
  that has to work when everything else is going wrong.

## What the model is worth right now

```
true positives  740      false positives    0
true negatives  399      false negatives    2
ROC AUC         1.0      PR AUC           1.0
```

## Security decisions

**One authorisation choke point.** Every read of a patient goes through
`authz.PatientAccess`, which returns one of `owner`, `granted`, `public` or
`denied`. There is no second place where this is decided, which is what makes
it possible to reason about at all.

**Login does not leak which accounts exist.** An unknown username used to
return in nanoseconds while a real one took the full bcrypt comparison, around
50 milliseconds. That difference is trivially measurable over a network and
turns login into an account enumeration oracle. A dummy hash is now verified on
the miss path so both take the same time.

**Grant links are signed, not stored, and not guessable.** The first design
under discussion was a link containing `hash(patient_id + doctor_id)`. Neither
of those is a secret: the patient id is in the QR and in the dashboard URL, and
a doctor obviously knows their own. Any doctor could have computed the hash and
let themselves in without the contact ever seeing an email.

What replaced it is an HMAC signed token:

```
payload = accident_uuid || request_uuid || expiry     (40 bytes, base64url)
token   = payload + "." + HMAC-SHA256(server_key, payload)
```

The ids are carried in the clear, so the server reads exactly which request to
act on with no lookup table and no scan. The signature is what makes it
trustworthy, and it cannot be produced without the server key. The expiry sits
inside the signed bytes, so editing the URL to extend it breaks the signature.
The signing key is domain separated from the one signing sessions, so a grant
token can never be replayed as a login.

A stateless token cannot burn itself after one use, so finality lives in the
database instead: only a `pending` request can be answered. That is what stops
an old email from quietly undoing a patient's revocation.

**The approval key is the one thing that is stored,** because there is no prior
row to point at. Only its SHA-256 hash is kept, and the row is looked up by
that hash rather than by the id in the URL, so a wrong key cannot be used to
probe which accident ids exist.

**Storage keys never leave the server.** Documents are addressed by a generated
key, and the client only ever receives short lived signed URLs. The uploader's
filename is discarded.

**The bucket is private and the service key is server side only.** The Supabase
`service_role` key bypasses that project's own row level security. It lives in
`.env` and must never reach a browser.

**Row level security is not enabled yet,** and the design is shaped so it can be
added without a rewrite. That means: one choke point, consent expressed as a
predicate, expiry evaluated at read time, and separate migrator and application
database roles. The last of those is still outstanding.

## Running it

You need Docker and Docker Compose. Nothing else.

```bash
git clone https://github.com/sathwikshetty33/ArogyaKhosh.git
cd ArogyaKhosh
cp .env.example .env
```

Open `.env` and set at minimum:

| Variable | Why |
|---|---|
| `JWT_SECRET` | Required. 32 bytes or more. `openssl rand -base64 48` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET` | Document storage. Without these, uploads are disabled but everything else runs |
| `SMTP_*` | The accident flow is email. Without these, mail is discarded silently |
| `APP_BASE_URL` | What emailed links point at. Must be reachable by the recipient |
| `AI_SERVICE_ADDR` | Read inside the backend container, so it is `ai:50051`, not localhost. Leave empty to run without scoring |

Then:

```bash
docker compose up --build
```

| Service | Where |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:8080 |
| Model service | localhost:50051 (gRPC) |
| Postgres | localhost:5433 |

Postgres is published on 5433 rather than 5432 so it does not collide with a
Postgres already running on the host.

`GET /readyz` reports what actually came up:

```json
{"status":"ready","database":"up","storage":"configured","mail":"configured","model":"configured"}
```

Migrations run automatically at startup.

### Working on it without Docker

```bash
# API
cd services/backend && go run .

# model service
cd services/ai && uv sync && uv run python server.py

# frontend
cd services/frontend && npm install && npm run dev
```

The Vite dev server proxies `/api` to the backend, which is why there is no
CORS configuration to get wrong in development.

### Regenerating the gRPC stubs

```bash
make proto
```

This generates both the Go client and the Python server from
`proto/ai_service.proto`. `grpc_tools` bundles its own protoc, so no system
protoc is needed.

## API

Everything is under `/api/v1`.

Public, no authentication, reached from a QR code or an email link:

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/accidents/:id` | Report an accident. Photo and location optional |
| `GET` | `/accidents/:id/approval/:key` | What the emergency contact is deciding about |
| `POST` | `/accidents/:id/approval/:key` | `confirm`, `dismiss` or `resolve` |
| `GET` | `/grants/:token` | Which doctor is asking |
| `POST` | `/grants/:token` | `grant` or `deny` |

Authentication:

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/auth/register/patient` | Role is fixed by the endpoint, never read from the body |
| `POST` | `/auth/register/doctor` | Same |
| `POST` | `/auth/login` | Username or email, plus password |
| `GET` | `/me` | The current session's user and profile |

Patients:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/patients/:id` | The record, filtered by access level |
| `PATCH` | `/patients/:id` | Update vitals and emergency contact |
| `GET` | `/patients/:id/requests` | Who has asked. Owner only |
| `GET` | `/patients/:id/accidents` | Reports, and who got in. Owner only |
| `POST` | `/patients/:id/documents` | Upload |
| `POST` | `/patients/:id/requests` | A doctor asking for access |
| `GET` | `/patients/search` | Exact username or email |
| `POST` | `/accidents/:id/close` | Stop diverting to the contact. Owner only |

Documents and requests:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/documents/:id/url` | A short lived signed download URL |
| `PATCH` | `/documents/:id` | Rename, or flip public and private |
| `DELETE` | `/documents/:id` | Delete |
| `POST` | `/requests/:id/approve` | Optional `expires_in_hours` |
| `POST` | `/requests/:id/decline` | Decline |
| `POST` | `/requests/:id/revoke` | Takes effect on the doctor's next read |

Patient search matches an exact username or email and nothing else. It is not
fuzzy, and that is the point. A doctor who can type a fragment and browse
results has a patient directory, which is not a thing this system hands out.

## Project layout

```
proto/                     the gRPC contract, one service, two messages
services/
  backend/                 Go, Gin, GORM
    internal/
      authz/               the single authorisation choke point
      auth/                JWT, bcrypt, approval keys, grant tokens
      mailer/              SMTP with header injection guards, STARTTLS required
      storage/             object storage behind an interface
      aiclient/            gRPC client for the model service
      models/              GORM models
      db/migrations/       versioned SQL, run by gormigrate
    server/                HTTP handlers, one file per area
  ai/                      Python, gRPC, stateless
    models/                the classifier ABC and the CLIP probe
    artifacts/             the trained head, 513 numbers of JSON
  ml/notebooks/            the training notebook
  frontend/                React, Vite, Tailwind, React Router
```

## License

MIT. See [LICENSE](LICENSE).

MIT rather than a copyleft licence because this is a project meant to be read,
copied from and argued with. Anything that makes a reader check with a lawyer
before borrowing an idea defeats that.
