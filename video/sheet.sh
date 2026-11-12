#!/usr/bin/env bash
# Contact sheet of a clip: N frames spread over its length, 4 per row, under 2000px wide.
set -euo pipefail
clip="$1"; n="${2:-8}"
d="$(dirname "$clip")/sheet-$(basename "$clip" .webm)"
mkdir -p "$d"; rm -f "$d"/*.png
len="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$clip" 2>/dev/null || echo 0)"
case "$len" in N/A|"") len="$(ffmpeg -i "$clip" -f null - 2>&1 | grep -o 'time=[0-9:.]*' | tail -1 | cut -d= -f2 | awk -F: '{print $1*3600+$2*60+$3}')";; esac
for i in $(seq 1 "$n"); do
  t="$(awk -v l="$len" -v i="$i" -v n="$n" 'BEGIN{printf "%.2f", l*(i-0.5)/n}')"
  ffmpeg -v error -ss "$t" -i "$clip" -frames:v 1 -vf scale=480:-1 "$d/$(printf %02d "$i").png" -y
done
magick montage "$d"/*.png -tile 4x -geometry +4+4 "$d.png"
echo "$d.png ($len s)"
