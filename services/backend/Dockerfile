FROM golang:1.26-alpine AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/api .

FROM alpine:3.22

RUN apk add --no-cache ca-certificates tzdata \
 && addgroup -S app \
 && adduser -S -G app -H -s /sbin/nologin app

COPY --from=build /out/api /usr/local/bin/api

USER app
EXPOSE 8080

ENV PORT=8080 \
    GIN_MODE=release

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O- "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/usr/local/bin/api"]
