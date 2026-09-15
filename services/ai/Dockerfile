FROM python:3.12-slim AS build

COPY --from=ghcr.io/astral-sh/uv:0.9.7 /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    HF_HOME=/opt/huggingface

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-install-project

COPY artifacts ./artifacts

# Bake the encoder into the image. It is ~600 MB, but a service that answers at
# a crash scene should not depend on Hugging Face being reachable, and startup
# stays predictable instead of waiting on a cold download.
RUN /app/.venv/bin/python -c "\
import json, pathlib; \
from transformers import AutoImageProcessor, CLIPVisionModelWithProjection; \
model = json.loads(pathlib.Path('artifacts/accident_head.json').read_text())['clip_model']; \
AutoImageProcessor.from_pretrained(model); \
CLIPVisionModelWithProjection.from_pretrained(model); \
print('cached', model)"

FROM python:3.12-slim

RUN addgroup --system app && adduser --system --ingroup app --no-create-home app

ENV PATH=/app/.venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HOME=/opt/huggingface \
    HF_HUB_OFFLINE=1 \
    PORT=50051

WORKDIR /app

COPY --from=build /app/.venv /app/.venv
COPY --from=build /opt/huggingface /opt/huggingface
COPY --chown=app:app artifacts ./artifacts
COPY --chown=app:app gen ./gen
COPY --chown=app:app models ./models
COPY --chown=app:app server.py healthcheck.py ./

USER app
EXPOSE 50051

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["python", "healthcheck.py"]

ENTRYPOINT ["python", "server.py"]
