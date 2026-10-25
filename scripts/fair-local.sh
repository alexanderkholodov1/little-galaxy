#!/bin/bash
# Runs Little Galaxy entirely on this machine: the Firestore and Auth emulators plus the game, reachable from every
# phone and computer on the same Wi-Fi, all sharing one galaxy. The sky is saved to LOCAL_DATA (default
# ./.local-sky) when you stop with Ctrl+C, and loaded again on the next start. No Firebase quota is used.
# Usage: scripts/fair-local.sh            then open http://<this machine's LAN IP>:4177/little-galaxy/
set -euo pipefail
cd "$(dirname "$0")/.."
data=${LOCAL_DATA:-$PWD/.local-sky}
mkdir -p "$data"
for port in 8080 9099 4177; do
  if (exec 3<>/dev/tcp/127.0.0.1/$port) 2>/dev/null; then echo "Port $port is already in use: stop the other emulator or server first." >&2; exit 1; fi
done
command -v java >/dev/null || { echo "Java is required by the Firebase emulators: install a JDK 21 (for example: sudo apt install openjdk-21-jre-headless)." >&2; exit 1; }
[ -d node_modules ] || pnpm install --frozen-lockfile
ip=$(hostname -I 2>/dev/null | awk '{print $1}'); ip=${ip:-127.0.0.1}
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx512m}
import=(); [ -f "$data/firebase-export-metadata.json" ] && import=(--import "$data")
pnpm exec firebase emulators:start --config firebase.lan.json --only firestore,auth --project demo-little-galaxy \
  "${import[@]}" --export-on-exit "$data" &
emulators=$!
trap 'kill $web 2>/dev/null; kill -INT $emulators 2>/dev/null; wait $emulators' EXIT INT TERM
until curl -s -o /dev/null http://127.0.0.1:8080 && curl -s -o /dev/null http://127.0.0.1:9099; do sleep 1; done
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 pnpm --filter @little-galaxy/stand exec tsx ../../scripts/local-seed.ts
VITE_USE_EMULATORS=1 pnpm --filter @little-galaxy/web exec vite --host 0.0.0.0 --port 4177 --strictPort &
web=$!
echo
echo "Little Galaxy (local):  http://$ip:4177/little-galaxy/"
echo "Booth screen:           http://$ip:4177/little-galaxy/screen"
echo "Admin:                  http://$ip:4177/little-galaxy/admin   (emulator Google sign-in: use the admin email)"
echo "Saved sky:              $data (written when you press Ctrl+C)"
wait $web
