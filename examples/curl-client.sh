#!/usr/bin/env sh
set -eu

gateway_base_url="${GATEWAY_BASE_URL:-http://localhost:3000}"

curl --fail-with-body --no-buffer \
  --header 'content-type: application/json' \
  --data '{"model":"mock-small","messages":[{"role":"user","content":"hello"}]}' \
  "${gateway_base_url}/v1/stream"
