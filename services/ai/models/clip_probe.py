import json
import math
import os
from pathlib import Path

import numpy as np
import torch
from PIL.Image import Image
from transformers import AutoImageProcessor, CLIPVisionModelWithProjection

from .model import AccidentClassifier

DEFAULT_ARTIFACT = Path(__file__).resolve().parent.parent / "artifacts" / "accident_head.json"

REQUIRED_KEYS = ("clip_model", "weights", "bias", "threshold")


def _sigmoid(logit: float) -> float:
    if logit >= 0:
        return 1.0 / (1.0 + math.exp(-logit))

    exp = math.exp(logit)
    return exp / (1.0 + exp)


class ClipLinearProbe(AccidentClassifier):
    """A frozen CLIP encoder with a trained linear head on top.

    The encoder is pulled from Hugging Face by the id recorded in the artifact;
    the artifact itself holds only the head, which is a few kilobytes.
    """

    def __init__(self, artifact_path: str | Path | None = None, device: str | None = None):
        path = Path(artifact_path or os.getenv("ACCIDENT_HEAD_PATH") or DEFAULT_ARTIFACT)

        if not path.is_file():
            raise FileNotFoundError(f"accident head not found at {path}")

        spec = json.loads(path.read_text())

        missing = [key for key in REQUIRED_KEYS if key not in spec]
        if missing:
            raise ValueError(f"{path} is missing {', '.join(missing)}")

        self._weights = np.asarray(spec["weights"], dtype=np.float32)
        self._bias = float(spec["bias"])
        self._threshold = float(spec["threshold"])
        self._clip_model = str(spec["clip_model"])

        declared = int(spec.get("embedding_dim", self._weights.size))
        if self._weights.size != declared:
            raise ValueError(
                f"{path} declares embedding_dim {declared} but carries "
                f"{self._weights.size} weights"
            )

        self._device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self._processor = AutoImageProcessor.from_pretrained(self._clip_model)
        self._encoder = (
            CLIPVisionModelWithProjection.from_pretrained(self._clip_model)
            .to(self._device)
            .eval()
        )

    @property
    def threshold(self) -> float:
        return self._threshold

    @property
    def name(self) -> str:
        return f"clip-linear-probe/{self._clip_model}"

    @torch.no_grad()
    def _embed(self, image: Image) -> np.ndarray:
        inputs = self._processor(images=[image.convert("RGB")], return_tensors="pt")
        inputs = inputs.to(self._device)

        output = self._encoder(pixel_values=inputs["pixel_values"])

        features = getattr(output, "image_embeds", None)
        if features is None:
            features = self._encoder.visual_projection(output.last_hidden_state[:, 0])

        features = features / features.norm(dim=-1, keepdim=True)

        return features.cpu().numpy()[0]

    def detect_accident(self, image: Image) -> tuple[float, bool]:
        features = self._embed(image)

        if features.shape != self._weights.shape:
            raise ValueError(
                f"{self._clip_model} produced {features.shape[0]} features but the "
                f"head expects {self._weights.shape[0]}; the artifact and the "
                f"encoder do not match"
            )

        confidence = _sigmoid(float(features @ self._weights) + self._bias)

        return confidence, confidence >= self._threshold
