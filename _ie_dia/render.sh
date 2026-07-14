#!/usr/bin/env bash
# Render each IE mermaid diagram TWICE (dark + light) and scope the SVG id.
set -u
cd "$(dirname "$0")"

render () {
  local base="$1"      # e.g. patho
  local variant="$2"   # dark | light
  local bg="$3"        # hex without #
  local id="$4"        # unique svg id
  local src="${base}.${variant}.mmd"
  local out="${base}.${variant}.svg"
  local B64
  B64=$(base64 -w0 "$src" | tr '+/' '-_')
  local code
  code=$(curl -s -o "$out" -w "%{http_code}" "https://mermaid.ink/svg/${B64}?bgColor=${bg}")
  if [ "$code" != "200" ]; then
    echo "  FAIL $src -> HTTP $code"
    head -c 300 "$out"; echo
    return 1
  fi
  # strip xml/doctype header if present, scope the id
  sed -i 's/<?xml[^>]*?>//g; s/<!DOCTYPE[^>]*>//g' "$out"
  sed -i "s/mermaid-svg/${id}/g" "$out"
  echo "  ok $out ($(wc -c < "$out") bytes, id=${id})"
}

for d in "$@"; do
  echo "== $d"
  case "$d" in
    patho)  render patho  dark 131c30 mmpathod; render patho  light f6f9fc mmpathol ;;
    dx)     render dx     dark 131c30 mmdxd;    render dx     light f6f9fc mmdxl ;;
    surg)   render surg   dark 131c30 mmsurgd;  render surg   light f6f9fc mmsurgl ;;
    abx)    render abx    dark 131c30 mmabxd;   render abx    light f6f9fc mmabxl ;;
  esac
  sleep 1
done
