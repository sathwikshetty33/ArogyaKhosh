# ArogyaKhosh — web

React + Vite + TypeScript frontend for the ArogyaKhosh health record system.

## Running locally

The backend must be up first (`docker compose up -d` from the repository root).

```sh
npm install
npm run dev
```

Vite proxies `/api` to `http://localhost:8080`, so the browser only ever talks to
one origin and the API needs no CORS configuration.

## Layout

```
src/
  components/   shared form and layout pieces
  lib/          API client and session storage
  pages/        one file per route
```
