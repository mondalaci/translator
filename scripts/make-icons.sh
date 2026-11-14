# Regenerate the PWA icons from the 1024px master. Needs ImageMagick.
#   npm run icons
set -euo pipefail
cd "$(dirname "$0")/.."

master="design/icon-1024.png"
out="public/icons"

convert "$master" -resize 512x512 "$out/icon-512.png"
convert "$master" -resize 192x192 "$out/icon-192.png"
# Maskable icons need the glyph inside the inner 80% safe zone.
convert -size 512x512 xc:black \( "$master" -resize 300x300 \) -gravity center -composite "$out/icon-maskable-512.png"
convert -size 180x180 xc:black \( "$master" -resize 150x150 \) -gravity center -composite "$out/apple-touch-icon.png"

echo "icons written to $out"
