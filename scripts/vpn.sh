#!/usr/bin/env bash
# Toggle NordVPN egress for the LibreChat api container.
#
#   vpn.sh on      bring up the gluetun sidecar, point api's PROXY at it, recreate api
#   vpn.sh off     clear PROXY, recreate api on direct egress, stop the sidecar
#   vpn.sh status  print the live /vpn-status JSON (connected / ip / country)
#
# State lives in the VM-local .env (PROXY=...), which survives `git reset --hard`,
# so the chosen mode persists across deploys. NordVPN creds (NORD_USER /
# NORD_PASSWORD) must already be present in .env; they are never committed.
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE="docker compose -f deploy-compose.yml -f docker-compose.override.yml"
ENV_FILE=".env"
PROXY_URL="http://gluetun:8888"

usage() {
  echo "Usage: vpn.sh on|off|status" >&2
  exit 2
}

set_env() {
  # set_env KEY VALUE — upsert KEY=VALUE in .env without touching other lines.
  local key="$1" value="$2"
  if grep -q "^${key}=" "${ENV_FILE}"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "${ENV_FILE}"
  else
    echo "${key}=${value}" >> "${ENV_FILE}"
  fi
}

recreate_api() {
  ${COMPOSE} up -d --force-recreate --no-deps api
}

vpn_on() {
  if ! grep -q '^NORD_USER=' "${ENV_FILE}" || ! grep -q '^NORD_PASSWORD=' "${ENV_FILE}"; then
    echo "ERROR: NORD_USER / NORD_PASSWORD missing from ${ENV_FILE}" >&2
    exit 1
  fi
  echo "Starting gluetun sidecar..."
  ${COMPOSE} --profile vpn up -d gluetun

  echo "Waiting for gluetun to report healthy..."
  for _ in $(seq 1 30); do
    status="$(docker inspect --format '{{.State.Health.Status}}' LibreChat-VPN 2>/dev/null || echo starting)"
    [ "${status}" = "healthy" ] && break
    sleep 2
  done
  if [ "${status:-}" != "healthy" ]; then
    echo "ERROR: gluetun did not become healthy (last: ${status:-unknown})" >&2
    exit 1
  fi

  set_env PROXY "${PROXY_URL}"
  recreate_api
  echo "VPN ON — api egress now routed through NordVPN."
}

vpn_off() {
  set_env PROXY ""
  recreate_api
  echo "Stopping gluetun sidecar..."
  ${COMPOSE} stop gluetun || true
  echo "VPN OFF — api egress is direct."
}

vpn_status() {
  # Hit the api container directly on its published port to skip Caddy's
  # HTTP->HTTPS redirect (which would fail TLS validation against localhost).
  curl -fsS localhost:3080/vpn-status || {
    echo "ERROR: /vpn-status did not respond" >&2
    exit 1
  }
  echo
}

case "${1:-}" in
  on) vpn_on ;;
  off) vpn_off ;;
  status) vpn_status ;;
  *) usage ;;
esac
