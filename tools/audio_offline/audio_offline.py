#!/usr/bin/env python3
"""Local audio preparation and measurement. No HTTP client or secret loading.

This tool cannot generate, upload, publish, or spend credits. Request exports are
data for a later authorized production runner, never executable shell commands.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
import re
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
WORK = HERE / "work"
PILOT = HERE / "pilot.json"
SFX_MODEL = "eleven_text_to_sound_v2"
API = "https://api.elevenlabs.io"
EXTENSIONS = {".wav", ".ogg", ".webm", ".mp3", ".flac", ".opus", ".m4a"}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def encoded(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode()


def fields(value: dict, expected: set[str]) -> None:
    if not isinstance(value, dict) or set(value) != expected:
        raise ValueError("Unexpected or missing config fields; headers and credentials are not accepted.")


def number(value: object, low: float, high: float) -> bool:
    return type(value) in (float, int) and math.isfinite(value) and low <= value <= high


def identifier(value: object) -> bool:
    return isinstance(value, str) and bool(re.fullmatch(r"[a-z][a-z0-9_-]{1,79}", value))


def validate(pilot: dict) -> list[dict]:
    fields(pilot, {"schema_version", "pilot_id", "status", "generation_scope", "reused_sfx_from", "music", "sfx"})
    if pilot["schema_version"] != 2 or pilot["status"] != "prepared_not_generated" or not identifier(pilot["pilot_id"]):
        raise ValueError("Invalid pilot identity or status.")
    if pilot["generation_scope"] != "music_replacements_only":
        raise ValueError("Only the two replacement music proposals may be prepared; existing SFX must not be regenerated.")
    fields(pilot["reused_sfx_from"], {"pilot_id", "flow_url", "status"})
    if pilot["reused_sfx_from"] != {
        "pilot_id": "sfg-guaira-pilot-01", "flow_url": "https://elevenlabs.io/app/flows/aoC2seBLqtH0qywcqdFt",
        "status": "generated_reported_by_root_awaiting_files_and_audition",
    }:
        raise ValueError("SFX reuse must reference the already generated pilot.")
    if not isinstance(pilot["music"], list) or not isinstance(pilot["sfx"], list) or len(pilot["music"]) != 2 or len(pilot["sfx"]) != 6:
        raise ValueError("Pilot must contain two music proposals and six SFX pairs.")
    requests = []
    for item in pilot["music"]:
        fields(item, {"cue_id", "variant", "title", "model_id", "duration_seconds", "output_format", "prompt"})
        if item["model_id"] != "music_v2_5" or item["output_format"] != "mp3_48000_192":
            raise ValueError("Music model and audition format must be explicit.")
        if not number(item["duration_seconds"], 30, 45):
            raise ValueError("Pilot music must be 30–45 seconds.")
        if not isinstance(item["prompt"], str) or not 1 <= len(item["prompt"]) <= 4100:
            raise ValueError("Music prompt exceeds API limits.")
        if re.search(r"\b(?:brazil\w*|brasil\w*|caipira|nintendo)\b", item["prompt"], re.I):
            raise ValueError("Music prompts must use the original arcade direction without regional or franchise references.")
        requests.append(request(item, "/v1/music", item["output_format"], {
            "model_id": item["model_id"], "prompt": item["prompt"],
            "music_length_ms": round(item["duration_seconds"] * 1000),
            "force_instrumental": True, "store_for_inpainting": False,
        }))
    sfx_ids = []
    for item in pilot["sfx"]:
        fields(item, {"cue_id", "title", "duration_seconds", "loop", "a", "b"})
        if not number(item["duration_seconds"], .5, 30) or type(item["loop"]) is not bool:
            raise ValueError("SFX requires an explicit duration of 0.5–30 seconds and boolean loop.")
        for variant in ("a", "b"):
            if not isinstance(item[variant], str) or not item[variant].strip():
                raise ValueError("Every SFX variant needs a prompt.")
            # Validate the legacy descriptions for identity and mapping, but do
            # not export them as fresh requests or accidentally charge twice.
            reused = request({**item, "variant": variant}, "/v1/sound-generation", "mp3_44100_128", {
                "model_id": SFX_MODEL, "text": item[variant],
                "duration_seconds": item["duration_seconds"], "loop": item["loop"], "prompt_influence": .35,
            })
            sfx_ids.append(reused["id"])
    ids = [r["id"] for r in requests]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate request identity.")
    if len(set(sfx_ids)) != 12:
        raise ValueError("SFX cue IDs must be distinct.")
    if {r["variant"] for r in requests[:2]} != {"a", "b"}:
        raise ValueError("Music proposals require variants a and b.")
    return requests


def request(item: dict, endpoint: str, output_format: str, body: dict) -> dict:
    if not identifier(item["cue_id"]) or item["variant"] not in ("a", "b") or not isinstance(item["title"], str):
        raise ValueError("Invalid cue identity.")
    return {
        "id": f'{item["cue_id"]}__{item["variant"]}__take01', "cue_id": item["cue_id"],
        "variant": item["variant"], "title": item["title"], "method": "POST", "endpoint": API + endpoint,
        "query": {"output_format": output_format}, "body": body,
    }


def estimate(requests: list[dict]) -> dict:
    music = sum(Decimal(str(r["body"]["music_length_ms"])) / 1000 for r in requests if "music_length_ms" in r["body"])
    sfx = sum(Decimal(str(r["body"]["duration_seconds"])) for r in requests if "duration_seconds" in r["body"])
    music_calls = sum("music_length_ms" in r["body"] for r in requests)
    sfx_calls = len(requests) - music_calls
    return {
        "network_calls_made": 0, "paid_requests_planned": len(requests), "automatic_retries": 0,
        "music_seconds": float(music), "sfx_seconds": float(sfx), "voices_planned": 0,
        "quote_confirmed_for_account": False, "approved_budget_usd": None, "estimated_credits": None,
        "spending_authority": "Two arcade replacement music outputs via parent plugin only, existing balance; reuse all 12 prior SFX candidates without regeneration.",
        "existing_sfx_to_reuse": 12,
        "reference_rates_usd_per_minute": {"music": .15, "sfx": .12},
        "illustrative_linear_usd_before_tax": float((music * Decimal('.15') + sfx * Decimal('.12')) / 60),
        "one_minute_per_call_hypothesis_usd_before_tax": float(music_calls * Decimal('.15') + sfx_calls * Decimal('.12')),
        "warning": "Illustrations, not a quote or spend cap. Official pricing also says per generation. Confirm account, minima, units, taxes, formats and budget before any call; do not convert dollars to credits by assumption.",
        "source": "https://elevenlabs.io/pricing/api", "checked_on": "2026-10-02",
    }


def safe_output(path: Path) -> Path:
    result = path.resolve()
    if not (result == WORK or WORK in result.parents or Path("/tmp") in result.parents):
        raise ValueError("Outputs are restricted to tools/audio_offline/work or /tmp; never another package or served path.")
    return result


def write_new(path: Path, data: bytes) -> None:
    path = safe_output(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as target:
        target.write(data)


def prepare(pilot: dict, output: Path) -> dict:
    requests = validate(pilot)
    output = safe_output(output)
    # An existing folder may be a prior take: never overwrite or silently retry it.
    output.mkdir(parents=True, exist_ok=False)
    manifest = {
        "pilot_id": pilot["pilot_id"], "execution_enabled": False, "publish_allowed": False,
        "generation_scope": pilot["generation_scope"], "reused_sfx_from": pilot["reused_sfx_from"],
        "generation_owner": "parent_root_plugin_only", "expected_new_outputs": 2,
        "network_secret_key_name_for_future_runner": "ELEVENLABS_API_KEY",
        "allowed_domain_for_future_runner": "api.elevenlabs.io",
        "auth_header_name_for_future_runner": "xi-api-key",
        "requests": [],
    }
    for r in requests:
        data = encoded(r)
        relative = f'requests/{r["id"]}.json'
        write_new(output / relative, data)
        manifest["requests"].append({"id": r["id"], "file": relative, "sha256": digest(data)})
    write_new(output / "manifest.json", encoded(manifest))
    write_new(output / "estimate.json", encoded(estimate(requests)))
    with (output / "selection.csv").open("x", newline="", encoding="utf-8") as target:
        columns = ["id", "status", "original_sha256", "reviewer", "heard_at_utc", "devices", "readability_1_5", "identity_1_5", "fatigue_1_5", "loop_result", "decision", "rights_evidence", "publish_allowed", "notes"]
        writer = csv.DictWriter(target, fieldnames=columns, lineterminator="\n")
        writer.writeheader()
        for r in requests:
            writer.writerow({"id": r["id"], "status": "not_generated", "decision": "pending", "publish_allowed": "false"})
    return {"output": str(output), "request_count": len(requests), "manifest_sha256": digest(encoded(manifest)), "network_calls_made": 0}


def run_local(args: list[str]) -> str:
    result = subprocess.run(args, capture_output=True, text=True, timeout=120, check=False)
    if result.returncode:
        # Avoid echoing full command, file contents or multimedia metadata on failure.
        raise ValueError(f"Local measurement failed: {args[0]} exited {result.returncode}.")
    return result.stdout


def audit_assets() -> dict:
    assets = []
    for path in sorted((ROOT / "public").rglob("*")):
        if path.suffix.lower() not in EXTENSIONS or not path.is_file():
            continue
        if path.is_symlink() or ROOT not in path.resolve().parents:
            raise ValueError("Audio audit refuses symlinked or external inputs.")
        probe = json.loads(run_local([
            "ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries",
            "format=duration,size:stream=codec_name,sample_rate,channels,sample_fmt,bits_per_sample,duration",
            "-of", "json", str(path),
        ]))
        if not probe.get("streams"):
            raise ValueError("Media file has no audio stream.")
        stream = probe["streams"][0]
        # Analysis only; loudnorm output goes to the null muxer, never back to sources.
        measured = subprocess.run([
            "ffmpeg", "-nostdin", "-hide_banner", "-i", str(path), "-map", "0:a:0",
            "-af", "loudnorm=I=-18:TP=-1:LRA=11:print_format=json", "-f", "null", "-",
        ], capture_output=True, text=True, timeout=120, check=False)
        if measured.returncode:
            raise ValueError("ffmpeg measurement failed; no source changed.")
        match = re.search(r'\{\s*"input_i".*?\}', measured.stderr, re.S)
        if match is None:
            raise ValueError("ffmpeg returned no loudness measurement.")
        levels = json.loads(match.group())
        relative = path.relative_to(ROOT).as_posix()
        group = "world_gallery" if "/world/audio/" in relative else "classic_music" if "/audio/music/" in relative else "joao_voice" if "/vo/joaozao/" in relative else "delicia" if "/assets_delicia/" in relative else "unclassified"
        duration = float(probe["format"].get("duration", stream.get("duration", 0)))
        def finite_or_none(value: str) -> float | None:
            parsed = float(value)
            return parsed if math.isfinite(parsed) else None
        assets.append({
            "path": relative, "group": group, "sha256": digest(path.read_bytes()), "bytes": path.stat().st_size,
            "duration_seconds": duration, "codec": stream["codec_name"], "sample_rate": int(stream["sample_rate"]),
            "channels": stream["channels"], "sample_format": stream["sample_fmt"], "bits_per_sample": stream.get("bits_per_sample"),
            "integrated_lufs": finite_or_none(levels["input_i"]), "true_peak_dbtp": finite_or_none(levels["input_tp"]),
            "loudness_range_lu": finite_or_none(levels["input_lra"]), "short_clip_loudness_caution": duration < 3,
            "heard": False,
        })
    counts = Counter(a["group"] for a in assets)
    return {
        "schema_version": 1, "measured_at_utc": datetime.now(timezone.utc).isoformat(),
        "base_commit": run_local(["git", "-C", str(ROOT), "rev-parse", "HEAD"]).strip(),
        "method": "ffprobe metadata + ffmpeg loudnorm input measurements to null output; SHA-256 originals; no listening",
        "ffmpeg_version": run_local(["ffmpeg", "-version"]).splitlines()[0],
        "file_count": len(assets), "total_bytes": sum(a["bytes"] for a in assets),
        "group_summary": {g: {"files": n, "bytes": sum(a["bytes"] for a in assets if a["group"] == g)} for g, n in sorted(counts.items())},
        "assets": assets,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["validate", "estimate", "prepare", "audit"])
    parser.add_argument("--output", type=Path, help="New output directory (prepare) or JSON file (audit); never served paths.")
    args = parser.parse_args()
    try:
        if args.command == "audit":
            if args.output is None:
                raise ValueError("audit requires --output.")
            safe_output(args.output)
            report = audit_assets()
            write_new(args.output, encoded(report))
            print(json.dumps({"file_count": report["file_count"], "total_bytes": report["total_bytes"], "group_summary": report["group_summary"], "heard": False}, ensure_ascii=False, indent=2))
        else:
            pilot = json.loads(PILOT.read_text(encoding="utf-8"))
            requests = validate(pilot)
            result = prepare(pilot, args.output or WORK / pilot["pilot_id"]) if args.command == "prepare" else estimate(requests)
            print(json.dumps(result, ensure_ascii=False, indent=2))
    except (ValueError, OSError, KeyError, TypeError, subprocess.TimeoutExpired):
        parser.exit(2, "Offline operation refused or local input/tool unavailable. Check schema, output isolation and required binaries. No network request was made.\n")


if __name__ == "__main__":
    main()
