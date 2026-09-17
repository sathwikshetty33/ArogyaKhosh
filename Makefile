GO_MODULE  := github.com/sathwikshetty33/ArogyaKhosh/services/backend
GOBIN      := $(shell go env GOPATH)/bin
PROTO_DIR  := proto
PROTOS     := $(wildcard $(PROTO_DIR)/*.proto)
GO_OUT     := services/backend
PY_OUT     := services/ai/gen

# protoc comes from grpcio-tools rather than a system install, so the only
# prerequisite is python plus the two Go plugins below.
PROTOC := python3 -m grpc_tools.protoc

.PHONY: proto proto-deps proto-go proto-py proto-clean up down logs provision creds

proto: proto-go proto-py
	@echo "stubs regenerated"

proto-deps:
	python3 -m pip install -q grpcio-tools
	go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

proto-go:
	@mkdir -p $(GO_OUT)
	$(PROTOC) -I $(PROTO_DIR) \
		--plugin=protoc-gen-go=$(GOBIN)/protoc-gen-go \
		--plugin=protoc-gen-go-grpc=$(GOBIN)/protoc-gen-go-grpc \
		--go_out=$(GO_OUT) --go_opt=module=$(GO_MODULE) \
		--go-grpc_out=$(GO_OUT) --go-grpc_opt=module=$(GO_MODULE) \
		$(PROTOS)

proto-py:
	@mkdir -p $(PY_OUT)
	$(PROTOC) -I $(PROTO_DIR) \
		--python_out=$(PY_OUT) \
		--pyi_out=$(PY_OUT) \
		--grpc_python_out=$(PY_OUT) \
		$(PROTOS)
	@touch $(PY_OUT)/__init__.py
	@# generated grpc files import their sibling by bare name, which only works
	@# if the output dir is on sys.path. Make it a relative import instead.
	@sed -i 's/^import \([a-z_]*\)_pb2 as /from . import \1_pb2 as /' $(PY_OUT)/*_pb2_grpc.py

proto-clean:
	rm -rf $(GO_OUT)/internal/gen $(PY_OUT)

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f backend

provision:
	@bash tools/provision.sh

creds:
	@bash tools/provision.sh --show
