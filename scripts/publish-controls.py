"""Stage edition assets by content hash; atomically activate only their HTML entry."""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import sys
import tarfile

mode, edition, release = sys.argv[1:4]
assert edition in ('classic', 'remastered')
assert re.fullmatch(r'controls-[0-9a-f]{12}', release)
root = (Path('/home/ubuntu/torbware-games/current/classic') if edition == 'classic'
        else Path('/home/ubuntu/super-feka-gaps-remaster/dist')).resolve()
assert root.is_dir() and (root / 'index.html').is_file()
work = Path('/home/ubuntu/.cache/feka-legacy-deploy') / edition / release
manifest = json.loads((work / 'manifest.json').read_text())
assert manifest['edition'] == edition and manifest['release'] == release
stage = root / 'releases' / ('.' + release + '.stage')
target = root / 'releases' / release

def safe_path(name):
    path = PurePosixPath(name)
    assert not path.is_absolute() and '..' not in path.parts and '\\' not in name
    assert name and str(path) == name
    return name

def digest(path):
    with path.open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()

entries = {safe_path(item['path']): item['sha256'] for item in manifest['files']}
assert 'index.html' in entries
if mode == 'plan':
    assert not target.exists(), 'This immutable release already exists'
    stage.mkdir(parents=True, exist_ok=True)
    candidates = [root] + sorted((root / 'releases').glob('*'), reverse=True)
    missing = []
    for name, checksum in entries.items():
        dest = stage / name
        if dest.is_file() and digest(dest) == checksum:
            continue
        existing = next((base / name for base in candidates if base != stage
                         and (base / name).is_file() and digest(base / name) == checksum), None)
        if existing:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(existing, dest)
        else:
            missing.append(name)
    print(json.dumps({'missing': missing, 'reused': len(entries) - len(missing)}))
elif mode == 'activate':
    assert stage.is_dir() and not target.exists()
    with tarfile.open(work / 'payload.tar.gz') as archive:
        for item in archive.getmembers():
            assert item.isfile() and safe_path(item.name) in entries
        archive.extractall(stage, filter='data')
    for name, checksum in entries.items():
        assert (stage / name).is_file() and digest(stage / name) == checksum, name
    html = (stage / 'index.html').read_text()
    assert '/releases/' + release + '/assets/' in html
    shutil.copyfile(root / 'index.html', work / 'index.previous.html')
    os.rename(stage, target)
    entry = root / ('.index-' + release)
    shutil.copyfile(target / 'index.html', entry)
    os.replace(entry, root / 'index.html')
    result = {'edition': edition, 'release': release, 'commit': manifest['commit'],
              'root': str(root), 'rollback': str(work / 'index.previous.html'),
              'productionBuild': 'passed', 'tests': 'not-run'}
    (work / 'published.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result))
else:
    raise ValueError('Unknown operation')
