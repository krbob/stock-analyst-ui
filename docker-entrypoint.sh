#!/bin/sh
set -e

if [ -z "${API_URL:-}" ]; then
  echo "API_URL must be set to the stock-analyst API origin, for example http://stock-analyst:8080" >&2
  exit 1
fi

# shellcheck disable=SC2016
envsubst '${API_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

show_chart_attribution=true
case "${SHOW_CHART_ATTRIBUTION:-}" in
  false|False|FALSE|0|no|No|NO|off|Off|OFF)
    show_chart_attribution=false
    ;;
esac

# Encode the optional cross-application URL so arbitrary environment content
# can never break out of the generated JavaScript string literal.
portfolio_url_base64=$(printf '%s' "${PORTFOLIO_URL:-}" | base64 | tr -d '\n')
portfolio_url_expression="undefined"
if [ -n "${portfolio_url_base64}" ]; then
  portfolio_url_expression="atob('${portfolio_url_base64}')"
fi

cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__STOCK_ANALYST_CONFIG__ = {
  showChartAttribution: ${show_chart_attribution},
  portfolioUrl: ${portfolio_url_expression},
};
EOF

exec "$@"
