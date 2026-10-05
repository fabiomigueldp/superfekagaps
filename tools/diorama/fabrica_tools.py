"""Shared provenance and frozen-geometry gates for the Factory reproduction tools."""
import hashlib
import json
import os
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = ROOT / '.cache/diorama/fabrica'
RUNTIME = ROOT / 'public/assets/world/map'
GEOMETRY_KEYS = ('world', 'size', 'camera', 'nodes', 'routes', 'secretRoute', 'worldRoutes')
SOURCE_FILES = ('tools/diorama/render_fabrica_map.py', 'tools/diorama/factory_enrichment.py',
                'tools/diorama/check_fabrica_clearance.py', 'tools/diorama/check_fabrica_billboard.py',
                'tools/diorama/fabrica_tools.py', 'docs/world/diorama/fabrica-runtime-envelopes.json')


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def text_sha256(path):
    text = Path(path).read_text(encoding='utf-8-sig').replace('\r\n', '\n')
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def source_hashes():
    return {name: text_sha256(ROOT / name) for name in SOURCE_FILES}


def read_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix='.' + path.name, dir=path.parent)
    try:
        with os.fdopen(descriptor, 'w', encoding='utf-8', newline='\n') as handle:
            json.dump(value, handle, indent=2, ensure_ascii=False)
            handle.write('\n')
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def validate_geometry(candidate, reference):
    for key in GEOMETRY_KEYS:
        if candidate.get(key) != reference.get(key):
            raise ValueError('Factory published geometry changed: ' + key)


def validate_envelopes(meta):
    report = read_json(ROOT / 'docs/world/diorama/fabrica-runtime-envelopes.json')
    if report.get('version') != 2 or report.get('model') != 'world-atlas':
        raise ValueError('Regenerate the Factory envelopes for the current atlas model.')
    if report['metadataSha256'] != text_sha256(RUNTIME / 'fabrica-diorama.meta.json'):
        raise ValueError('Factory envelope metadata is stale; regenerate and audit.')
    for name, expected in report['sourceHashes'].items():
        if text_sha256(ROOT / name) != expected:
            raise ValueError('Factory envelope runtime source is stale: ' + name)
    validate_geometry(meta, report['sourceGeometry'])
    return report


def validate_audits(meta):
    for name, positive, zero in (
        ('auditSummary', ('headroomRayCount', 'supportRayCount'), ('obstructionCount', 'unsupportedCount')),
        ('projectedAuditSummary', ('sampleCount',), ('conflictCount',)),
        ('billboardAuditSummary', ('sampleCount',), ('equipmentContactCount',)),
    ):
        audit = meta.get(name, {})
        if any(not isinstance(audit.get(key), (int, float)) or audit[key] <= 0 for key in positive):
            raise ValueError('Missing positive Factory audit samples: ' + name)
        if any(audit.get(key) != 0 for key in zero):
            raise ValueError('Factory clearance failed: ' + name)


def stage_render_record(output, meta, scene, blender_version, rendered):
    output = Path(output)
    record = {'sourceHashes': source_hashes(), 'blenderVersion': blender_version,
              'rendered': rendered, 'samples': scene.cycles.samples,
              'sceneObjectCount': len(scene.objects),
              'sceneSha256': sha256(output / 'fabrica-map-prototype.blend')
              if (output / 'fabrica-map-prototype.blend').is_file() else None,
              'geometry': {key: meta[key] for key in GEOMETRY_KEYS},
              'files': {name: sha256(output / 'export' / name) for name in
                        ('fabrica-diorama.png', 'fabrica-diorama.meta.json')
                        if rendered and (output / 'export' / name).is_file()}}
    write_json(output / 'fabrica-source-provenance.json', record)
    return record
