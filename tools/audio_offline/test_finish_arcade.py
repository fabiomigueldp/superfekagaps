"""Check the real FFmpeg edit contract, without production, network or credentials."""
import array
import math
from pathlib import Path
import tempfile
import unittest
import wave
import finish_arcade as production

class LoopEditingTests(unittest.TestCase):
    def test_preroll_crossfade_preserves_exact_period_instead_of_shortening_loop(self):
        with tempfile.TemporaryDirectory() as folder:
            source, target = Path(folder) / "test.wav", Path(folder) / "loop.wav"
            samples = array.array("h", (round(math.sin(i * math.tau / 480) * 12000) for i in range(24000)))
            with wave.open(str(source), "wb") as out:
                out.setparams((1, 2, 48000, len(samples), "NONE", "not compressed")); out.writeframes(samples.tobytes())
            graph = production.filter_graph({"kind": "music", "start": .12, "end": .42, "crossfade": .04}, 48000)
            production.run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(source), "-filter_complex", graph,
                            "-map", "[out]", "-c:a", "pcm_s16le", str(target)])
            with wave.open(str(target), "rb") as result:
                self.assertEqual(result.getnframes(), 14400)
                self.assertEqual(result.getframerate(), 48000)

    def test_loop_requires_real_preroll_and_positive_range(self):
        for start, end, crossfade in [(0, 1, .04), (1, .5, .04), (.12, .13, .04)]:
            with self.assertRaises(ValueError):
                production.filter_graph({"kind": "music", "start": start, "end": end, "crossfade": crossfade}, 48000)

if __name__ == "__main__": unittest.main()
