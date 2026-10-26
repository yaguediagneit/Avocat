#!/usr/bin/env bash
# Sauvegarde Cabinet AJR : base PostgreSQL + documents MinIO, chiffrés par rclone crypt
# puis envoyés sur Cloudflare R2. Quotidien gardé 30 jours, mensuel (le 1er) gardé 1 an.
set -euo pipefail

PROJECT="${PROJECT:-gg2dzrlxqblurzml61mlf3xb}"
REMOTE="${REMOTE:-r2crypt:}"
LOCAL_DIR="${LOCAL_DIR:-/root/backup/local}"
LOCAL_KEEP_DAYS="${LOCAL_KEEP_DAYS:-3}"
DAILY_KEEP_DAYS="${DAILY_KEEP_DAYS:-30}"
MONTHLY_KEEP_DAYS="${MONTHLY_KEEP_DAYS:-366}"

STAMP="$(date +%F_%H%M)"
WORK="$LOCAL_DIR/$STAMP"

log() { echo "[$(date '+%F %T')] $*"; }
fail() { log "ECHEC : $*"; exit 1; }

PG_CONTAINER="$(docker ps \
  --filter "label=com.docker.compose.project=$PROJECT" \
  --filter "label=com.docker.compose.service=avocat-postgres" \
  --format '{{.Names}}' | head -1)"
[ -n "$PG_CONTAINER" ] || fail "conteneur PostgreSQL introuvable (projet $PROJECT)"
docker volume inspect "${PROJECT}_miniodata" >/dev/null 2>&1 || fail "volume ${PROJECT}_miniodata introuvable"

mkdir -p "$WORK"

log "Dump PostgreSQL ($PG_CONTAINER)"
docker exec "$PG_CONTAINER" pg_dump -U avocat -d avocat -Fc > "$WORK/avocat-db.dump"
[ -s "$WORK/avocat-db.dump" ] || fail "dump PostgreSQL vide"

log "Archive des documents MinIO"
docker run --rm -v "${PROJECT}_miniodata:/data:ro" alpine tar czf - -C /data . > "$WORK/avocat-minio.tar.gz"
[ -s "$WORK/avocat-minio.tar.gz" ] || fail "archive MinIO vide"

cp /data/coolify/proxy/dynamic/avocat.yaml "$WORK/" 2>/dev/null || true
(cd "$WORK" && sha256sum ./* > SHA256SUMS)

log "Envoi vers ${REMOTE}daily/$STAMP"
rclone copy "$WORK" "${REMOTE}daily/$STAMP"
if [ "$(date +%d)" = "01" ]; then
  log "Copie mensuelle ${REMOTE}monthly/$(date +%Y-%m)"
  rclone copy "$WORK" "${REMOTE}monthly/$(date +%Y-%m)"
fi

log "Rotation (distant : ${DAILY_KEEP_DAYS} j / ${MONTHLY_KEEP_DAYS} j, local : ${LOCAL_KEEP_DAYS} j)"
rclone delete --min-age "${DAILY_KEEP_DAYS}d" "${REMOTE}daily"
rclone delete --min-age "${MONTHLY_KEEP_DAYS}d" "${REMOTE}monthly" 2>/dev/null || true
find "$LOCAL_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"$LOCAL_KEEP_DAYS" -exec rm -rf {} +

log "Sauvegarde terminée : $(du -sh "$WORK" | cut -f1)"
