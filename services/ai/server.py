import io
import logging
import os
import signal
import sys
from concurrent import futures

import grpc
from grpc_health.v1 import health, health_pb2, health_pb2_grpc
from PIL import Image, UnidentifiedImageError

from gen import ai_service_pb2 as pb
from gen import ai_service_pb2_grpc as rpc
from models.model import AccidentClassifier

SERVICE_NAME = "arogyakhosh.ai.v1.AccidentVerifier"

MAX_IMAGE_BYTES = int(os.getenv("MAX_IMAGE_BYTES", 20 * 1024 * 1024))
MAX_IMAGE_PIXELS = int(os.getenv("MAX_IMAGE_PIXELS", 50_000_000))
GRACE_SECONDS = float(os.getenv("SHUTDOWN_GRACE_SECONDS", 15))

log = logging.getLogger("arogyakhosh.ai")


class AccidentVerifier(rpc.AccidentVerifierServicer):
    def __init__(self, classifier: AccidentClassifier):
        self._classifier = classifier

    def VerifyAccident(self, request, context):
        if not request.image:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "image is required")

        if len(request.image) > MAX_IMAGE_BYTES:
            context.abort(
                grpc.StatusCode.INVALID_ARGUMENT,
                f"image must be {MAX_IMAGE_BYTES // (1024 * 1024)} MB or smaller",
            )

        try:
            image = Image.open(io.BytesIO(request.image))
            image.load()
        except UnidentifiedImageError:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "not a readable image")
        except Image.DecompressionBombError:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "image resolution is too large")
        except OSError as err:
            log.warning("could not decode image: %s", err)
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "image could not be decoded")

        try:
            confidence, is_accident = self._classifier.detect_accident(image)
        except Exception:
            log.exception("inference failed")
            context.abort(grpc.StatusCode.INTERNAL, "could not score the image")

        log.info(
            "verified image bytes=%d content_type=%s confidence=%.4f accident=%s",
            len(request.image),
            request.content_type or "-",
            confidence,
            is_accident,
        )

        return pb.VerifyAccidentResponse(
            confidence=confidence,
            threshold=self._classifier.threshold,
            is_accident=is_accident,
        )


def build_server(classifier: AccidentClassifier, port: int, workers: int):
    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=workers),
        options=[
            # Headroom above the limit the handler enforces, so a slightly
            # oversized image gets a readable INVALID_ARGUMENT rather than a
            # bare transport-level RESOURCE_EXHAUSTED. Grossly oversized
            # requests are still cut off here before they are buffered.
            ("grpc.max_receive_message_length", MAX_IMAGE_BYTES + (4 << 20)),
            ("grpc.max_send_message_length", 1 << 20),
        ],
    )

    rpc.add_AccidentVerifierServicer_to_server(AccidentVerifier(classifier), server)

    health_servicer = health.HealthServicer()
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)

    server.add_insecure_port(f"[::]:{port}")

    return server, health_servicer


def serve():
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        stream=sys.stdout,
    )

    Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS

    port = int(os.getenv("PORT", 50051))
    workers = int(os.getenv("MAX_WORKERS", 4))

    from models.clip_probe import ClipLinearProbe

    log.info("loading the accident classifier")
    classifier = ClipLinearProbe()
    log.info("loaded %s, threshold %.4f", classifier.name, classifier.threshold)

    server, health_servicer = build_server(classifier, port, workers)
    server.start()

    health_servicer.set("", health_pb2.HealthCheckResponse.SERVING)
    health_servicer.set(SERVICE_NAME, health_pb2.HealthCheckResponse.SERVING)

    log.info("serving on :%d with %d workers", port, workers)

    def shutdown(signum, _frame):
        log.info("signal %s received, draining", signal.Signals(signum).name)
        health_servicer.set("", health_pb2.HealthCheckResponse.NOT_SERVING)
        health_servicer.set(SERVICE_NAME, health_pb2.HealthCheckResponse.NOT_SERVING)
        server.stop(GRACE_SECONDS)

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    server.wait_for_termination()
    log.info("stopped")


if __name__ == "__main__":
    serve()
