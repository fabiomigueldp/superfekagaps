"""Factory packaging/provenance regression tests; no Blender dependency or runtime writes."""
import copy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

import fabrica_tools as tools
from package_fabrica_map import package_factory


class FactoryToolsTest(unittest.TestCase):
    def setUp(self):
        self.metadata = tools.read_json(tools.RUNTIME / 'fabrica-diorama.meta.json')

    def test_current_envelopes_match_the_published_geometry(self):
        report = tools.validate_envelopes(self.metadata)
        self.assertEqual(report['model'], 'world-atlas')
        self.assertEqual(len(report['profiles']), 20)

    def test_geometry_drift_is_rejected(self):
        changed = copy.deepcopy(self.metadata)
        changed['nodes']['3-1']['x'] += .01
        with self.assertRaisesRegex(ValueError, 'nodes'):
            tools.validate_geometry(changed, self.metadata)

    def test_source_hashes_are_portable_across_windows_and_linux(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'linux.txt').write_bytes(b'one\ntwo\n')
            (root / 'windows.txt').write_bytes(b'\xef\xbb\xbfone\r\ntwo\r\n')
            self.assertEqual(tools.text_sha256(root / 'linux.txt'), tools.text_sha256(root / 'windows.txt'))

    def test_stale_runtime_source_and_metadata_are_rejected(self):
        report = tools.validate_envelopes(self.metadata)
        for field in ('metadataSha256', 'sourceHashes'):
            changed = copy.deepcopy(report)
            if field == 'sourceHashes':
                changed[field]['src/adventure/WorldAtlasArt.ts'] = 'obsolete'
            else:
                changed[field] = 'obsolete'
            with patch.object(tools, 'read_json', return_value=changed):
                with self.assertRaisesRegex(ValueError, 'stale'):
                    tools.validate_envelopes(self.metadata)

    def test_clearance_requires_positive_samples_and_zero_obstructions(self):
        for name, key, value in [('auditSummary', 'supportRayCount', 0),
                                 ('projectedAuditSummary', 'conflictCount', 1),
                                 ('billboardAuditSummary', 'equipmentContactCount', 1)]:
            changed = copy.deepcopy(self.metadata)
            changed[name][key] = value
            with self.assertRaises(ValueError):
                tools.validate_audits(changed)

    def fixture(self, root, clipped=False):
        export = root / 'export'
        export.mkdir()
        image = Image.new('RGBA', (1920, 1200))
        bounds = self.metadata['artBounds']
        box = (tuple(round(bounds[key] * size) for key, size in
                     zip(('left', 'top', 'right', 'bottom'), (1920, 1200, 1920, 1200))))
        image.paste((40, 80, 120, 255), (0, 0, 1920, 1200) if clipped else box)
        image.save(export / 'fabrica-diorama.png')
        tools.write_json(export / 'fabrica-diorama.meta.json', self.metadata)
        proof = {'rendered': True, 'sourceHashes': tools.source_hashes(), 'geometry': self.metadata,
                 'files': {name: tools.sha256(export / name) for name in
                           ('fabrica-diorama.png', 'fabrica-diorama.meta.json')}}
        tools.write_json(root / 'fabrica-source-provenance.json', proof)
        return proof

    def test_staged_package_preserves_published_metadata_and_does_not_install(self):
        original = {name: (tools.RUNTIME / name).read_bytes() for name in
                    ('fabrica-diorama.webp', 'fabrica-diorama.meta.json')}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            manifest = package_factory(root, root / 'package')
            self.assertLessEqual(manifest['runtimeBytes'], 350_000)
            self.assertEqual((root / 'package/fabrica-diorama.meta.json').read_bytes(), original['fabrica-diorama.meta.json'])
        for name, expected in original.items():
            self.assertEqual((tools.RUNTIME / name).read_bytes(), expected)

    def test_package_rejects_a_render_changed_after_its_audit(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            (root / 'export/fabrica-diorama.png').write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError, 'provenance'):
                package_factory(root, root / 'package')
            self.assertFalse((root / 'package').exists())

    def test_package_rejects_an_old_source_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            proof = self.fixture(root)
            proof['sourceHashes']['tools/diorama/factory_enrichment.py'] = 'old'
            tools.write_json(root / 'fabrica-source-provenance.json', proof)
            with self.assertRaisesRegex(ValueError, 'stale'):
                package_factory(root, root / 'package')

    def test_package_rejects_clipped_factory_art(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root, clipped=True)
            with self.assertRaisesRegex(ValueError, 'clipped'):
                package_factory(root, root / 'package')


if __name__ == '__main__':
    unittest.main()
