#!/bin/sh
set -e

if [ -z "${API_URL:-}" ]; then
  echo "API_URL must be set to the stock-analyst API origin, for example http://stock-analyst:8080" >&2
  exit 1
fi

# shellcheck disable=SC2016
envsubst '${API_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

exec "$@"
