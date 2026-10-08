#!/usr/bin/env bash
# Replace only the new-api container. MySQL, .env secrets, data, logs, and
# new-api-network stay in place. One instance runs at a time.
set -Eeuo pipefail

root=/root/new-api
compose_file="${root}/docker-compose.yml"
env_file="${root}/.env"
container=new-api
mysql_container=new-api-mysql
network=new-api-network
registry_image=docker.io/zengwenliang0416/new-api
sha="${CI_COMMIT_SHA:-}"
image="${registry_image}:${sha}"
previous_image=""
switched=0
backup_dir=""

log() {
  printf '[new-api-deploy] %s\n' "$*"
}

fail() {
  log "ERROR: $*"
  exit 1
}

restore_env() {
  if [[ -n "$backup_dir" && -f "${backup_dir}/.env" ]]; then
    cp -a "${backup_dir}/.env" "$env_file"
    chmod 600 "$env_file"
  fi
}

rollback() {
  local status=$?
  if [[ "$status" -eq 0 || -z "$backup_dir" ]]; then
    return
  fi
  if [[ "$switched" -eq 1 ]]; then
    log "rolling back container to ${previous_image}"
  else
    log "restoring production env without recreating the container"
  fi
  restore_env
  if [[ "$switched" -eq 1 ]]; then
    (
      cd "$root"
      docker compose --project-name new-api up -d --no-deps --force-recreate "$container"
    ) || log "rollback compose failed"
    docker logs --tail 40 "$container" 2>&1 | grep -Ei -v 'password|secret|dsn|token' || true
  fi
}

trap rollback EXIT

[[ "${CI_PIPELINE_EVENT:-}" != "pull_request" ]] || fail "refusing to deploy a pull request"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || fail "CI_COMMIT_SHA must be the full Git commit"
[[ -f Dockerfile && -f "$compose_file" && -f "$env_file" ]] || fail "build or production files are missing"
grep -q 'container_name: new-api-mysql' "$compose_file" || fail "compose no longer defines new-api-mysql"
grep -q 'name: new-api-network' "$compose_file" || fail "compose no longer defines new-api-network"
[[ "$(docker inspect -f '{{.State.Running}}' "$mysql_container")" == "true" ]] || fail "MySQL is not running"
docker network inspect "$network" >/dev/null

printf '%s\n' "$sha" > VERSION
log "building ${image}"
docker build --progress=plain --tag "$image" .
log "pushing ${image}"
docker push "$image"

previous_image="$(docker inspect -f '{{.Config.Image}}' "$container")"
[[ "$previous_image" != "$image" ]] || fail "production is already running ${image}"
backup_dir="${root}/backups/$(date -u +%Y%m%dT%H%M%SZ)-${sha:0:12}"
mkdir -p "$backup_dir"
chmod 700 "${root}/backups" "$backup_dir"
cp -a "$env_file" "${backup_dir}/.env"
cp -a "$compose_file" "${backup_dir}/docker-compose.yml"
chmod 600 "${backup_dir}/.env"
printf '%s\n' "$previous_image" > "${backup_dir}/previous-image"
chmod 600 "${backup_dir}/previous-image"

tmp_env="$(mktemp)"
if grep -q '^NEW_API_IMAGE=' "$env_file"; then
  grep -v '^NEW_API_IMAGE=' "$env_file" > "$tmp_env" || true
else
  cat "$env_file" > "$tmp_env"
fi
printf 'NEW_API_IMAGE=%s\n' "$image" >> "$tmp_env"
cat "$tmp_env" > "$env_file"
chmod 600 "$env_file"
rm -f "$tmp_env"

resolved="$(cd "$root" && docker compose --project-name new-api config --images)"
printf '%s\n' "$resolved" | grep -qx "$image" || fail "compose did not resolve ${image}"

log "replacing ${container}"
switched=1
(
  cd "$root"
  docker compose --project-name new-api up -d --no-deps --force-recreate "$container"
)

deadline=$((SECONDS + 480))
healthy=0
while (( SECONDS < deadline )); do
  status="$(docker inspect -f '{{.State.Status}}' "$container")"
  if [[ "$status" == "exited" || "$status" == "dead" ]]; then
    docker logs --tail 50 "$container" 2>&1 | grep -Ei -v 'password|secret|dsn|token' || true
    fail "new container exited"
  fi
  if docker run --rm --network "container:${container}" curlimages/curl:8.16.0 \
    --fail --silent --show-error --max-time 5 http://127.0.0.1:3000/api/status \
    | grep -Eq '"success"[[:space:]]*:[[:space:]]*true'; then
    healthy=1
    break
  fi
  sleep 5
done
[[ "$healthy" -eq 1 ]] || fail "health check timed out"

[[ "$(docker inspect -f '{{.Config.Image}}' "$container")" == "$image" ]] || fail "running image does not match ${image}"
[[ "$(docker inspect -f '{{.State.Running}}' "$mysql_container")" == "true" ]] || fail "MySQL stopped during deploy"
[[ "$(docker inspect -f '{{(index .NetworkSettings.Ports "3000/tcp" 0).HostIp}}' "$container")" == "127.0.0.1" ]] || fail "API is no longer bound to localhost"
[[ "$(docker inspect -f '{{(index .NetworkSettings.Ports "3000/tcp" 0).HostPort}}' "$container")" == "3000" ]] || fail "API port changed"
[[ "$(docker inspect -f '{{.HostConfig.Memory}}' "$container")" == "3221225472" ]] || fail "memory limit changed"
[[ "$(docker inspect -f '{{.HostConfig.MemorySwap}}' "$container")" == "4294967296" ]] || fail "memory swap limit changed"
[[ "$(docker inspect -f '{{.HostConfig.NanoCpus}}' "$container")" == "2000000000" ]] || fail "CPU limit changed"
[[ "$(docker inspect -f '{{.HostConfig.PidsLimit}}' "$container")" == "256" ]] || fail "PID limit changed"
docker inspect -f '{{json .NetworkSettings.Networks}}' "$container" | grep -q "$network" || fail "container left ${network}"

log "deployment succeeded: image=${image} previous=${previous_image} backup=${backup_dir}"
