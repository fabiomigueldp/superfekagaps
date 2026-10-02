"""Regression checks for preparation boundaries; no API access or real secrets."""
import copy
import json
from pathlib import Path
import socket
import tempfile
import unittest
from unittest.mock import patch

import audio_offline as pipeline


class OfflinePipelineTests(unittest.TestCase):
    def setUp(self):
        self.pilot = json.loads(pipeline.PILOT.read_text())

    def test_budget_counts_all_variants_without_hidden_retries(self):
        requests = pipeline.validate(self.pilot)
        estimate = pipeline.estimate(requests)
        self.assertEqual(estimate["paid_requests_planned"], 2)
        self.assertEqual((estimate["music_seconds"], estimate["sfx_seconds"]), (80, 0))
        self.assertEqual(estimate["illustrative_linear_usd_before_tax"], .2)
        self.assertEqual(estimate["one_minute_per_call_hypothesis_usd_before_tax"], .3)
        self.assertEqual(estimate["existing_sfx_to_reuse"], 12)
        self.assertIsNone(estimate["approved_budget_usd"])
        self.assertIsNone(estimate["estimated_credits"])

    def test_payload_cannot_smuggle_headers_or_change_music_model(self):
        cases = []
        bad = copy.deepcopy(self.pilot); bad["headers"] = {"xi-api-key": "TEST_SENTINEL_NOT_A_KEY"}; cases.append(bad)
        bad = copy.deepcopy(self.pilot); bad["music"][0]["model_id"] = "music_v1"; cases.append(bad)
        bad = copy.deepcopy(self.pilot); bad["sfx"][0]["duration_seconds"] = 30.01; cases.append(bad)
        bad = copy.deepcopy(self.pilot); bad["sfx"][0]["duration_seconds"] = float("nan"); cases.append(bad)
        bad = copy.deepcopy(self.pilot); bad["sfx"][0]["loop"] = "false"; cases.append(bad)
        bad = copy.deepcopy(self.pilot); bad["sfx"][0]["cue_id"] = "../../public/injected"; cases.append(bad)
        bad = copy.deepcopy(self.pilot); bad["sfx"][1]["cue_id"] = bad["sfx"][0]["cue_id"]; cases.append(bad)
        bad = copy.deepcopy(self.pilot); bad["generation_scope"] = "all_assets"; cases.append(bad)
        bad = copy.deepcopy(self.pilot); bad["schema_version"] = 1; cases.append(bad)
        bad = copy.deepcopy(self.pilot); bad["music"][0]["prompt"] += " Brazilian regional style"; cases.append(bad)
        for pilot in cases:
            with self.subTest(pilot=cases.index(pilot)), self.assertRaises(ValueError):
                pipeline.validate(pilot)

    def test_export_works_with_all_network_sockets_disabled_and_never_overwrites(self):
        # Historical pre-generation export; the active pilot is now complete.
        self.pilot["status"] = "prepared_not_generated"
        with tempfile.TemporaryDirectory() as folder, patch.object(socket, "socket", side_effect=AssertionError("Network forbidden")):
            output = Path(folder) / "pilot"
            pipeline.prepare(self.pilot, output)
            manifest = json.loads((output / "manifest.json").read_text())
            self.assertFalse(manifest["execution_enabled"])
            self.assertFalse(manifest["publish_allowed"])
            self.assertEqual(len(list((output / "requests").glob("*.json"))), 2)
            self.assertEqual(manifest["expected_new_outputs"], 2)
            for item in manifest["requests"]:
                data = (output / item["file"]).read_bytes()
                self.assertEqual(item["sha256"], pipeline.digest(data))
                request = json.loads(data)
                self.assertEqual(request["endpoint"], "https://api.elevenlabs.io/v1/music")
                self.assertNotIn("headers", request)
                self.assertNotIn("seed", request["body"])
            with self.assertRaises(FileExistsError):
                pipeline.prepare(self.pilot, output)

    def test_completed_pilot_cannot_export_duplicate_requests(self):
        self.assertEqual(self.pilot["status"], "generated_by_parent")
        self.assertEqual(pipeline.estimate(pipeline.validate(self.pilot), completed=True)["paid_requests_planned"], 0)
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "duplicate"
            with self.assertRaisesRegex(ValueError, "already generated"):
                pipeline.prepare(self.pilot, output)
            self.assertFalse(output.exists())

    def test_outputs_cannot_enter_runtime_or_source_even_via_symlink(self):
        for destination in (pipeline.ROOT / "public/audio-review", pipeline.ROOT / "src/audio-review", pipeline.ROOT / "dist/audio-review", pipeline.ROOT.parent / "another-package/audio-review"):
            with self.assertRaises(ValueError):
                pipeline.safe_output(destination)
        with tempfile.TemporaryDirectory() as folder:
            link = Path(folder) / "served-link"
            link.symlink_to(pipeline.ROOT / "public", target_is_directory=True)
            with self.assertRaises(ValueError):
                pipeline.safe_output(link / "audio-review")


if __name__ == "__main__":
    unittest.main()
