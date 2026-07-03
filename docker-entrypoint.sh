#!/bin/sh
set -e

API_URL="${API_URL:-http://localhost:8080}"

# shellcheck disable=SC2016
envsubst '${API_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

exec "$@"
