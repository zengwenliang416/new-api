#!/bin/sh
# Switch only the new-api container back to the previous image recorded in
# deploy-state/release.json. MySQL, data, logs, and the deploy agent stay up.
set -eu
set -o pipefail

root=/root/new-api
state_dir="${DEPLOY_STATE_DIR:-${root}/deploy-state}"
release_file="${state_dir}/release.json"
status_file="${state_dir}/rollback-status.json"
env_file="${root}/.env"
compose_file="${root}/docker-compose.yml"
override_file="${root}/deploy-agent-compose.yml"
container=new-api
mysql_container=new-api-mysql
network=new-api-network
allowed='^(docker\.io/)?zengwenliang0416/new-api:[0-9a-f]{40}$|^calciumion/new-api:v1\.0\.0-rc\.23$'

log() {
  printf '[new-api-rollback] %s\n' "$*"
}

fail() {
  log "ERROR: $*"
  exit 1
}

json_get() {
  local file="$1" key="$2"
  sed -n "s/.*\"${key}\":\"\\([^\"]*\\)\".*/\\1/p" "$file" | head -n 1
}

write_status() {
  local state="$1"
  local tmp="${status_file}.tmp"
  printf '{"state":"%s","started_at":"%s"}\n' "$state" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$tmp"
  chmod 644 "$tmp"
  mv "$tmp" "$status_file"
}

read_release() {
  [ -f "$release_file" ] || fail "release record is missing"
  current_image="$(json_get "$release_file" current_image)"
  previous_image="$(json_get "$release_file" previous_image)"
  current_version="$(json_get "$release_file" current_version)"
  previous_version="$(json_get "$release_file" previous_version)"
  if [ -z "$current_image" ] || [ -z "$previous_image" ] || [ "$current_image" = "$previous_image" ]; then
    fail "no previous image is available"
  fi
  printf '%s\n' "$previous_image" | grep -Eq "$allowed" || fail "previous image is not a known rollback target"
}

if [ "${1:-}" = "--print-target" ]; then
  read_release
  printf '%s\n' "$previous_image"
  exit 0
fi

read_release
exec 9>"${root}/bin/rollback.lock"
flock -n 9 || fail "rollback already running"

compose() {
  (
    cd "$root"
    docker compose --project-name new-api -f "$compose_file" -f "$override_file" "$@"
  )
}

backup_dir=""
switched=0
restore() {
  status=$?
  if [ "$status" -eq 0 ]; then
    return
  fi
  if [ -n "$backup_dir" ] && [ -f "${backup_dir}/.env" ]; then
    cp -a "${backup_dir}/.env" "$env_file"
    chmod 600 "$env_file"
  fi
  if [ -n "$backup_dir" ] && [ -f "${backup_dir}/release.json" ]; then
    cp -a "${backup_dir}/release.json" "$release_file"
    chmod 644 "$release_file"
  fi
  write_status failed || true
  if [ "$switched" -eq 1 ]; then
    log "restoring ${current_image}"
    compose up -d --no-deps --force-recreate "$container" || log "restore compose failed"
  fi
}
trap restore EXIT

write_status running
# Let the admin API finish its response before the container is replaced.
sleep 2

docker image inspect "$previous_image" >/dev/null || fail "previous image is not on this host"
[ "$(docker inspect -f '{{.State.Running}}' "$mysql_container")" = "true" ] || fail "MySQL is not running"

backup_dir="${root}/backups/rollback-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
chmod 700 "${root}/backups" "$backup_dir"
cp -a "$env_file" "${backup_dir}/.env"
cp -a "$release_file" "${backup_dir}/release.json"
chmod 600 "${backup_dir}/.env"

tmp_env="$(mktemp)"
if grep -q '^NEW_API_IMAGE=' "$env_file"; then
  grep -v '^NEW_API_IMAGE=' "$env_file" > "$tmp_env" || true
else
  cat "$env_file" > "$tmp_env"
fi
printf 'NEW_API_IMAGE=%s\n' "$previous_image" >> "$tmp_env"
cat "$tmp_env" > "$env_file"
chmod 600 "$env_file"
rm -f "$tmp_env"

switched=1
compose up -d --no-deps --force-recreate "$container"

elapsed=0
healthy=0
while [ "$elapsed" -lt 480 ]; do
  container_status="$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || true)"
  if [ "$container_status" = "exited" ] || [ "$container_status" = "dead" ]; then
    docker logs --tail 50 "$container" 2>&1 | grep -Ei -v 'password|secret|dsn|token' || true
    fail "rolled back container exited"
  fi
  if docker run --rm --network "container:${container}" curlimages/curl:8.16.0 \
    --fail --silent --show-error --max-time 5 http://127.0.0.1:3000/api/status \
    | grep -Eq '"success"[[:space:]]*:[[:space:]]*true'; then
    healthy=1
    break
  fi
  sleep 5
  elapsed=$((elapsed + 5))
done
[ "$healthy" -eq 1 ] || fail "health check timed out"
[ "$(docker inspect -f '{{.Config.Image}}' "$container")" = "$previous_image" ] \
  || fail "running image does not match ${previous_image}"
[ "$(docker inspect -f '{{.State.Running}}' "$mysql_container")" = "true" ] || fail "MySQL stopped during rollback"
docker inspect -f '{{json .NetworkSettings.Networks}}' "$container" | grep -q "$network" || fail "container left ${network}"

tmp_release="$(mktemp)"
printf '{"current_image":"%s","previous_image":"%s","current_version":"%s","previous_version":"%s","deployed_at":"%s"}\n' \
  "$previous_image" "$current_image" "$previous_version" "$current_version" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  > "$tmp_release"
chmod 644 "$tmp_release"
mv "$tmp_release" "$release_file"
write_status succeeded
log "rollback succeeded: image=${previous_image}"
