# Regenerate the window icon from the 1024px master. Needs ImageMagick.
#   npm run icons
set -euo pipefail
cd "$(dirname "$0")/.."

master="design/icon-1024.png"
out="public/icons"
mkdir -p "$out"

convert "$master" -resize 512x512 "$out/icon-512.png"
convert "$master" -resize 256x256 "$out/icon-256.png"

echo "icons written to $out"
