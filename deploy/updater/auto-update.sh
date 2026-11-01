#!/bin/sh
# Watches a git checkout and redeploys the `web` service whenever HEAD changes:
#  - new commits pushed to the remote (fetched and fast-forwarded when FETCH_REMOTE=true)
#  - commits made directly in the mounted checkout
# A failed build (including failing tests) leaves the running version untouched.
set -u

REPO_DIR=${REPO_DIR:-/repo}
COMPOSE_FILE_NAME=${COMPOSE_FILE_NAME:-docker-compose.selfhost.yml}
SERVICE=${SERVICE:-web}
BRANCH=${BRANCH:-main}
INTERVAL=${INTERVAL:-30}
FETCH_REMOTE=${FETCH_REMOTE:-true}
STATE_FILE=${STATE_FILE:-/state/deployed-sha}

log() { echo "[updater $(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

mkdir -p "$(dirname "$STATE_FILE")"

if [ ! -d "$REPO_DIR/.git" ]; then
  log "ERROR: $REPO_DIR is not a git repository (mount your checkout at $REPO_DIR)"
  exit 1
fi

# Run git as the owner of the checkout so fetches/fast-forwards never leave root-owned
# files behind in the host's working copy.
OWNER=$(stat -c '%u:%g' "$REPO_DIR")
g() { su-exec "$OWNER" env HOME=/tmp git -c safe.directory="$REPO_DIR" -C "$REPO_DIR" "$@"; }

deploy() {
  sha=$(g rev-parse HEAD)
  APP_VERSION=$(sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' "$REPO_DIR/package.json" | head -n 1)
  BUILD_NUMBER=$(g rev-list --count HEAD)
  BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  GIT_SHA=$sha
  export APP_VERSION BUILD_NUMBER BUILD_DATE GIT_SHA

  log "Deploying v$APP_VERSION build $BUILD_NUMBER ($(echo "$sha" | cut -c1-7)): $(g log -1 --format=%s)"
  if docker compose --project-directory "$REPO_DIR" -f "$REPO_DIR/$COMPOSE_FILE_NAME" up -d --build --no-deps "$SERVICE"; then
    echo "$sha" > "$STATE_FILE"
    docker image prune -f >/dev/null 2>&1 || true
    log "Live: v$APP_VERSION build $BUILD_NUMBER"
  else
    log "Build or deploy failed - the previous version keeps running. Will retry on the next commit."
    # Remember the failed SHA so we don't rebuild it in a loop.
    echo "$sha" > "$STATE_FILE"
  fi
}

log "Watching $REPO_DIR (branch $BRANCH, every ${INTERVAL}s, fetch remote: $FETCH_REMOTE)"
while true; do
  if [ "$FETCH_REMOTE" = "true" ] && [ -n "$(g remote)" ]; then
    if g fetch --quiet origin "$BRANCH" 2>/dev/null; then
      if [ "$(g rev-parse HEAD)" != "$(g rev-parse "origin/$BRANCH")" ]; then
        if g merge-base --is-ancestor HEAD "origin/$BRANCH"; then
          log "New commits on origin/$BRANCH - fast-forwarding"
          g merge --ff-only --quiet "origin/$BRANCH" || log "Fast-forward failed (local changes?)"
        fi
      fi
    else
      log "git fetch failed (offline or no access) - checking local commits only"
    fi
  fi

  head=$(g rev-parse HEAD 2>/dev/null || echo "")
  deployed=$(cat "$STATE_FILE" 2>/dev/null || echo "")
  if [ -n "$head" ] && [ "$head" != "$deployed" ]; then
    deploy
  fi
  sleep "$INTERVAL"
done
