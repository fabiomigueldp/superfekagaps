"""Validate a fresh staged Factory render and package it without changing runtime assets."""
import argparse
import os
import shutil
import tempfile
from pathlib import Path

from PIL import Image

from fabrica_tools import (RUNTIME, read_json, sha256, source_hashes, validate_audits,
                           validate_envelopes, validate_geometry, write_json)


def package_factory(input_dir, output_dir):
    export = input_dir / 'export'
    proof = read_json(input_dir / 'fabrica-source-provenance.json')
    if not proof.get('rendered') or proof.get('sourceHashes') != source_hashes():
        raise ValueError('Factory render is absent or based on stale source files.')
    for name in ('fabrica-diorama.png', 'fabrica-diorama.meta.json'):
        if proof.get('files', {}).get(name) != sha256(export / name):
            raise ValueError('Factory rendered file no longer matches its audit provenance: ' + name)
    meta = read_json(export / 'fabrica-diorama.meta.json')
    published = read_json(RUNTIME / 'fabrica-diorama.meta.json')
    validate_geometry(meta, published)
    validate_geometry(meta, proof['geometry'])
    validate_envelopes(meta)
    validate_audits(meta)
    with Image.open(export / 'fabrica-diorama.png') as image:
        image = image.convert('RGBA')
        if image.size != (1920, 1200):
            raise ValueError('Package requires the full 1920x1200 final render.')
        bounds = image.getchannel('A').getbbox()
        if not bounds or bounds[0] <= 0 or bounds[1] <= 0 or bounds[2] >= image.width or bounds[3] >= image.height:
            raise ValueError('Factory artwork is empty or clipped by its frame.')
        expected = published['artBounds']
        for actual, key, size in zip(bounds, ('left', 'top', 'right', 'bottom'), (1920, 1200, 1920, 1200)):
            if abs(actual - expected[key] * size) > 1.01:
                raise ValueError('Factory alpha framing changed; review and reconcile published metadata: ' + key)
        output_dir.mkdir(parents=True, exist_ok=True)
        candidate = output_dir / 'fabrica-diorama.webp'
        image.save(candidate, 'WEBP', quality=91, method=6, exact=True, alpha_quality=100)
    metadata = (RUNTIME / 'fabrica-diorama.meta.json').read_bytes()
    if candidate.stat().st_size + len(metadata) > 350_000:
        raise ValueError('Factory image and metadata exceed the 350 KB payload budget.')
    (output_dir / 'fabrica-diorama.meta.json').write_bytes(metadata)
    manifest = {'sourceHashes': source_hashes(), 'sourceRenderFiles': proof['files'],
                'publishedMetadataPreserved': True, 'alphaBounds': list(bounds),
                'freshAudits': {key: meta[key] for key in ('auditSummary', 'projectedAuditSummary', 'billboardAuditSummary')},
                'baseRuntime': {name: sha256(RUNTIME / name) for name in ('fabrica-diorama.webp', 'fabrica-diorama.meta.json')},
                'assets': {name: {'sha256': sha256(output_dir / name), 'bytes': (output_dir / name).stat().st_size}
                           for name in ('fabrica-diorama.webp', 'fabrica-diorama.meta.json')}}
    manifest['runtimeBytes'] = sum(asset['bytes'] for asset in manifest['assets'].values())
    write_json(output_dir / 'fabrica-art-manifest.json', manifest)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input-dir', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path)
    parser.add_argument('--install-assets', action='store_true')
    options = parser.parse_args()
    input_dir = options.input_dir.resolve()
    output_dir = (options.output_dir or input_dir / 'package').resolve()
    if output_dir == RUNTIME.resolve() or RUNTIME.resolve() in output_dir.parents:
        raise ValueError('Use a staged output directory; --install-assets installs the reviewed package.')
    manifest = package_factory(input_dir, output_dir)
    if options.install_assets:
        for name, expected in manifest['baseRuntime'].items():
            if sha256(RUNTIME / name) != expected:
                raise ValueError('Published Factory files changed since packaging; reconcile first.')
        descriptor, temporary = tempfile.mkstemp(prefix='.fabrica-', suffix='.webp', dir=RUNTIME)
        os.close(descriptor)
        try:
            shutil.copyfile(output_dir / 'fabrica-diorama.webp', temporary)
            os.replace(temporary, RUNTIME / 'fabrica-diorama.webp')
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
    print('FABRICA_PACKAGE=' + str(output_dir / 'fabrica-art-manifest.json'))


if __name__ == '__main__':
    main()
