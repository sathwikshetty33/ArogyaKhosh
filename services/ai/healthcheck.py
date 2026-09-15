import os
import sys

import grpc
from grpc_health.v1 import health_pb2, health_pb2_grpc

TARGET = f"127.0.0.1:{os.getenv('PORT', '50051')}"

try:
    with grpc.insecure_channel(TARGET) as channel:
        response = health_pb2_grpc.HealthStub(channel).Check(
            health_pb2.HealthCheckRequest(service=""), timeout=3
        )
except grpc.RpcError as err:
    print(f"health check failed: {err.code().name}", file=sys.stderr)
    sys.exit(1)

if response.status != health_pb2.HealthCheckResponse.SERVING:
    print(health_pb2.HealthCheckResponse.ServingStatus.Name(response.status), file=sys.stderr)
    sys.exit(1)
