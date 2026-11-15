#!/usr/bin/env bash
# Launch the overlay.
#
# Some environments here export ELECTRON_RUN_AS_NODE=1 (it is set in the shell
# and in the pm2 daemon), which turns the Electron binary into plain Node — the
# process starts, logs nothing, and never opens a window. Unset it first.
set -euo pipefail

cd "$(dirname "$0")/.."
unset ELECTRON_RUN_AS_NODE

exec ./node_modules/.bin/electron electron/main.mjs "$@"
