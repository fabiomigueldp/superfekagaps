#!/usr/bin/env python3
"""Reproduce local arcade edits from verified originals; FFmpeg only, no network.

Writes to a NEW staging directory, never directly to public or to originals.
FLAC editing masters retain the limitations of the supplied lossy MP3 sources.
"""
from __future__ import annotations
import argparse
import array
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
CONFIG = Path(__file__).with_name("arcade-edits.json")

def run(args: list[str]) -> subprocess.CompletedProcess:
    result = subprocess.run(args, capture_output=True, timeout=120)
    if result.returncode:
        raise ValueError(f"Local {args[0]} operation failed ({result.returncode}); original unchanged.")
    return result

def db(value: float) -> float | None:
    return round(20 * math.log10(value), 5) if value > 0 else None

def measure(path: Path) -> dict:
    probe = json.loads(run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries",
                           "stream=sample_rate,channels,codec_name", "-of", "json", str(path)]).stdout)["streams"][0]
    values = array.array("f", run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(path), "-f", "f32le", "-"]).stdout)
    if sys.byteorder != "little": values.byteswap()
    channels = probe["channels"]
    peak = max(abs(n) for n in values)
    rms = math.sqrt(sum(n * n for n in values) / len(values))
    report = run(["ffmpeg", "-nostdin", "-hide_banner", "-i", str(path), "-af",
                  "loudnorm=I=-18.5:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"])
    levels = json.loads(re.search(rb'\{\s*"input_i".*?\}', report.stderr, re.S).group())
    def finite(value: str) -> float | None:
        n = float(value); return n if math.isfinite(n) else None
    return {"sample_rate": int(probe["sample_rate"]), "channels": channels, "codec": probe["codec_name"],
            "decoded_samples_per_channel": len(values) // channels,
            "decoded_seconds": len(values) / channels / int(probe["sample_rate"]),
            "peak_dbfs": db(peak), "rms_dbfs": db(rms), "integrated_lufs": finite(levels["input_i"]),
            "true_peak_dbtp": finite(levels["input_tp"]),
            "loop_boundary_delta_dbfs": db(max(abs(values[c] - values[-channels + c]) for c in range(channels))),
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "bytes": path.stat().st_size}

def filter_graph(edit: dict, sr: int) -> str:
    start, end = round(edit["start"] * sr), round(edit["end"] * sr)
    if start < 0 or end <= start: raise ValueError("Invalid edit range")
    base = f"[0:a]aresample={sr}"
    if edit["kind"] != "music": base += ",pan=mono|c0=0.5*c0+0.5*c1"
    if edit.get("crossfade"):
        overlap = round(edit["crossfade"] * sr)
        if start < overlap or end - start <= overlap: raise ValueError("Invalid preroll for loop")
        # Match the last sample to the sample before the loop start. This keeps
        # the intended musical period; ordinary end/head overlap shortens it.
        return (base + ",asplit=3[a][b][c];"
                f"[a]atrim=start_sample={start}:end_sample={end-overlap},asetpts=PTS-STARTPTS[head];"
                f"[b]atrim=start_sample={end-overlap}:end_sample={end},asetpts=PTS-STARTPTS[tail];"
                f"[c]atrim=start_sample={start-overlap}:end_sample={start},asetpts=PTS-STARTPTS[preroll];"
                f"[tail]afade=t=out:ss=0:ns={overlap}[fadeout];"
                f"[preroll]afade=t=in:ss=0:ns={overlap}[fadein];"
                "[fadeout][fadein]amix=inputs=2:duration=longest:normalize=0[seam];"
                "[head][seam]concat=n=2:v=0:a=1[out]")
    base += f",atrim=start_sample={start}:end_sample={end},asetpts=PTS-STARTPTS"
    if edit["kind"] == "warning":
        # Make a consistent two-pip warning from each original's immediate hit.
        # The 140 ms spacing is an audio edit, never a gameplay timer.
        return (base + ",afade=t=in:d=0.002,afade=t=out:st=0.075:d=0.025,asplit=2[first][up];"
                "[up]asetrate=57082,aresample=48000,adelay=140[second];"
                "[first][second]amix=inputs=2:normalize=0,apad=pad_dur=0.03,atrim=duration=0.25[out]")
    duration = (end - start) / sr
    return base + f",afade=t=in:d={edit.get('fade_in',.002)},afade=t=out:st={duration-.018}:d=0.018[out]"

def produce(output: Path) -> dict:
    config = json.loads(CONFIG.read_text())
    output = output.resolve()
    if Path("/tmp") not in output.parents and (ROOT / "tools/audio_offline/work") not in output.parents:
        raise ValueError("Use /tmp or tools/audio_offline/work for staging")
    source = ROOT / config["source_folder"]
    inputs = {a["number"]: a for a in json.loads((source / "technical-manifest.json").read_text())}
    for item in inputs.values():
        path = source / "originais" / item["file"]
        if path.is_symlink() or path.stat().st_size != item["bytes"] or hashlib.sha256(path.read_bytes()).hexdigest() != item["sha256"]:
            raise ValueError("Original hash/size verification failed")
    output.mkdir(parents=True, exist_ok=False)
    for folder in ("masters", "delivery", "working"): (output / folder).mkdir()
    records = []
    for edit in config["edits"]:
        item = inputs[edit["source_number"]]; original = source / "originais" / item["file"]
        working = output / "working" / (edit["id"] + ".wav")
        graph = filter_graph(edit, config["sample_rate"])
        run(["ffmpeg", "-nostdin", "-v", "error", "-n", "-i", str(original), "-filter_complex", graph,
             "-map", "[out]", "-map_metadata", "-1", "-c:a", "pcm_f32le", str(working)])
        before = measure(working)
        gain = edit["peak_ceiling"] - before["true_peak_dbtp"]
        if "lufs" in edit: gain = min(gain, edit["lufs"] - before["integrated_lufs"])
        if "rms" in edit: gain = min(gain, edit["rms"] - before["rms_dbfs"])
        master = output / "masters" / (edit["id"] + ".flac")
        run(["ffmpeg", "-nostdin", "-v", "error", "-n", "-i", str(working), "-af", f"volume={gain:.8f}dB",
             "-map_metadata", "-1", "-c:a", "flac", "-sample_fmt", "s32", "-compression_level", "8", str(master)])
        extension, codec = (".mp3", ["-c:a", "libmp3lame", "-b:a", "192k"]) if edit["kind"] == "music" else (".wav", ["-c:a", "pcm_s16le"])
        delivery = output / "delivery" / (edit["id"] + extension)
        run(["ffmpeg", "-nostdin", "-v", "error", "-n", "-i", str(master), "-map_metadata", "-1", *codec, str(delivery)])
        records.append({"id": edit["id"], "source": item, "edit": edit, "filter_graph": graph, "gain_db": round(gain, 8),
                        "master": measure(master), "delivery": measure(delivery), "delivery_file": delivery.name,
                        "heard": False, "artistic_approval": False, "commercial_license_verified": False})
    report = {"source_commit": config["source_commit"], "originals_verified": len(inputs),
              "method": "Linear level edits, recorded trims and preroll loop crossfades; no perceptual audition",
              "ffmpeg_version": run(["ffmpeg", "-version"]).stdout.decode().splitlines()[0], "records": records}
    (output / "production-manifest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    return {"files": len(records), "delivery_bytes": sum(r["delivery"]["bytes"] for r in records),
            "master_bytes": sum(r["master"]["bytes"] for r in records), "heard": False}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument("output", type=Path)
    args = parser.parse_args()
    print(json.dumps(produce(args.output), indent=2))
