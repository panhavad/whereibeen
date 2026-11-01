#!/bin/sh
# Runs from the nginx image entrypoint before nginx starts. Writes the runtime config the
# browser app reads from /config.json, so one image works for any domain / OAuth client.
set -eu

CONFIG_FILE=/usr/share/nginx/html/config.json

json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

client_id="${GOOGLE_CLIENT_ID:-}"
printf '{"googleClientId":"%s"}\n' "$(json_escape "$client_id")" > "$CONFIG_FILE"

if [ -n "$client_id" ]; then
  echo "whereibeen: Google sign-in enabled"
else
  echo "whereibeen: GOOGLE_CLIENT_ID not set - Google sign-in disabled (demo, Timeline import and manual entry still work)"
fi
