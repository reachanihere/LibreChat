#!/usr/bin/env bash
# Dumps the LibreChat Mongo DB and uploads a gzip archive to Azure Blob.
# Retention is enforced by the storage account lifecycle policy (3 days);
# this script only uploads.
# Usage: backup-mongo.sh <storage-account-name>
set -euo pipefail

STORAGE="${1:?storage account name required}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="librechat-${TS}.archive.gz"
TMP="/tmp/${ARCHIVE}"

# Dump straight out of the running mongo container (tools ship in the image).
docker exec chat-mongodb sh -c 'mongodump --db LibreChat --archive --gzip' > "${TMP}"

# Fail loudly if the dump is empty/corrupt.
if [ ! -s "${TMP}" ]; then
  echo "ERROR: dump is empty" >&2
  rm -f "${TMP}"
  exit 1
fi

SIZE="$(stat -c%s "${TMP}")"

# Auth with the VM's managed identity (no stored keys) and upload.
az login --identity --only-show-errors >/dev/null
az storage blob upload \
  --account-name "${STORAGE}" \
  --container-name mongo-backups \
  --name "${ARCHIVE}" \
  --file "${TMP}" \
  --auth-mode login \
  --only-show-errors

rm -f "${TMP}"
echo "Uploaded mongo-backups/${ARCHIVE} (${SIZE} bytes)"
