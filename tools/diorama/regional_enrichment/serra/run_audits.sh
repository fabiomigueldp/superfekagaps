#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")" && pwd)
DIR=${1:-"$ROOT/final"}
BLEND=${2:-"$DIR/serra-enriched.blend"}
cp "$ROOT/source/serra-audit-sprite-source.json" "$DIR/serra-audit-sprite-source.json"
FEKA_SERRA_AUDIT_OUT="$DIR" blender -b -t 4 "$BLEND" -P "$ROOT/source/check_serra_clearance.py" -- --phase 0 --raster --label phase0 > "$DIR/audit-phase0.log" 2>&1 & P0=$!
FEKA_SERRA_AUDIT_OUT="$DIR" blender -b -t 4 "$BLEND" -P "$ROOT/source/check_serra_clearance.py" -- --phase 1 --raster --label phase1 > "$DIR/audit-phase1.log" 2>&1 & P1=$!
FEKA_SERRA_AUDIT_OUT="$DIR" blender -b -t 4 "$BLEND" -P "$ROOT/source/check_serra_cabins.py" -- --continuous --label cabins > "$DIR/audit-cabins.log" 2>&1 & PC=$!
FEKA_SERRA_AUDIT_OUT="$DIR" blender -b -t 4 "$BLEND" -P "$ROOT/source/check_serra_rider_raster.py" -- --step .0005 --scenery --label rider > "$DIR/audit-rider.log" 2>&1 & PR=$!
wait "$P0"; wait "$P1"; wait "$PC"; wait "$PR"
python "$ROOT/source/analyze_serra_stationary_head.py" phase0 --root "$DIR"
python "$ROOT/source/analyze_serra_stationary_head.py" phase1 --root "$DIR"
blender -b -t 4 "$BLEND" -P "$ROOT/audit_invariants.py" > "$DIR/audit-invariants.log" 2>&1
