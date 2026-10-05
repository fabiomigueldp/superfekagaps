"""Produce original DLC audio. The key stays in memory; it is never copied into assets.

Run with --key-file pointing to a plain key or a file containing ELEVENLABS_API_KEY=...
Successful files are reused; failed generations are recorded, never retried automatically.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/world/delicia/audio'
SFX = [
    ('orchard-air', 12, True, 'Seamless peaceful tropical citrus orchard ambience, light breeze rustling orange leaves, distant birds, soft trickling water, subtle clean game ambience, no speech no music'),
    ('collect', 1, False, 'One delightful magical citrus crystal pickup, bright glass chime and juicy tiny bubble pop, crisp playful console platformer sound, no music'),
    ('dash', 1, False, 'One quick energetic orange juice dash whoosh, fizzy fluid rush with sparkling trailing droplets, crisp clean platformer movement effect'),
    ('seed', 1, False, 'One springy cartoon citrus seed slingshot, wooden click with quick whistling zip and tiny juicy pop, clean action game effect'),
    ('parry', 1.5, False, 'One satisfying perfect parry against a brass machine, bright metallic clang, glass citrus chime and short sparkling magical tail, console action game'),
    ('pound', 2, False, 'One heavy cartoon ground pound on sandstone, bassy punch, crunchy rock crack, scattered pebbles and splashing orange juice, punchy action game effect'),
    ('pressure', 3, False, 'Brass orange juice refinery valve opening, short squeaky wheel twist, building pneumatic hiss and powerful liquid burst with settling drips, no speech'),
    ('warning', 1.5, False, 'One clearly audible friendly dangerous machine warning, rising mechanical whistle with three short brass pulses, game attack telegraph, no speech'),
    ('boss-hit', 1.5, False, 'One powerful satisfying hit on armored cartoon villain, deep brass clang and pulpy citrus splat, tight game impact with sparkling tail, no voice'),
    ('victory', 4, False, 'Joyful short fantasy platformer victory flourish, celesta arpeggio, triumphant brass chord, marimba and bright magical citrus sparkle, polished four second reward jingle'),
]
MUSIC = [
    ('orchard', 'Original instrumental console platformer exploration music, sunny Brazilian citrus island, playful marimba and cavaquinho, expressive flute melody, warm upright bass, light samba percussion, sophisticated playful orchestration, 116 BPM, seamless repeating musical phrases with a short introduction, bright adventure and discovery, no vocals, 60 seconds'),
    ('reservoir', 'Original instrumental fantasy platformer music for an ancient orange juice aqueduct at twilight, lyrical celesta and flute, watery harp arpeggios, warm strings, Brazilian hand percussion, mysterious beautiful melodic exploration, 100 BPM, clear looping musical phrases, restrained rich arrangement, no vocals, 60 seconds'),
    ('guina', 'Original instrumental challenging platformer boss battle music, fictional citrus refinery tyrant, dramatic low brass and strings, punchy Brazilian percussion, marimba motif answering imposing brass melody, driving 146 BPM, playful theatrical menace, powerful rhythmic pulse, polished console soundtrack, recurring orange island melodic motif, no vocals, 60 seconds'),
]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--key-file', required=True)
    args = parser.parse_args()
    raw = Path(args.key_file).read_text(encoding='utf-8-sig').strip()
    match = re.search(r'(?:sk_|xi_)[A-Za-z0-9_-]{16,}', raw)
    key = match.group(0) if match else raw.split('=', 1)[-1].strip().strip('"\'')
    if '\n' in key or len(key) < 20:
        raise SystemExit('Key file format not recognized; no requests sent.')
    OUT.mkdir(parents=True, exist_ok=True)
    manifest_path = ROOT / 'docs/world/delicia/audio-manifest.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {'provider': 'ElevenLabs', 'assets': []}
    headers = {'xi-api-key': key, 'Content-Type': 'application/json'}
    tasks = [(name, 'sound-generation', {'text': prompt, 'duration_seconds': seconds, 'loop': loop, 'prompt_influence': .5, 'model_id': 'eleven_text_to_sound_v2'}) for name, seconds, loop, prompt in SFX]
    tasks += [(name, 'music', {'prompt': prompt, 'music_length_ms': 60000, 'model_id': 'music_v2', 'force_instrumental': True}) for name, prompt in MUSIC]
    for name, endpoint, body in tasks:
        destination = OUT / (name + '.mp3')
        if destination.exists() and destination.stat().st_size > 1000:
            print(name + ': reused', flush=True)
            continue
        if any(a['name'] == name and a.get('status') == 'failed' for a in manifest['assets']):
            print(name + ': prior failure, skipped', flush=True)
            continue
        try:
            response = requests.post('https://api.elevenlabs.io/v1/' + endpoint, headers=headers, params={'output_format': 'mp3_44100_128'}, json=body, timeout=240)
            if response.status_code != 200:
                print(name + ': HTTP ' + str(response.status_code), flush=True)
                manifest['assets'].append({'name': name, 'status': 'failed', 'http': response.status_code, 'prompt': body.get('text', body.get('prompt'))})
                manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
                if response.status_code in (401, 402, 403, 429):
                    print('Account unavailable for additional generation; stopping.', flush=True)
                    break
                continue
            if len(response.content) < 1000 or 'audio' not in response.headers.get('content-type', ''):
                print(name + ': invalid audio response', flush=True)
                continue
            destination.write_bytes(response.content)
            manifest['assets'].append({'name': name, 'status': 'generated', 'file': destination.relative_to(ROOT).as_posix(), 'model': body['model_id'], 'prompt': body.get('text', body.get('prompt')), 'bytes': len(response.content), 'sha256': hashlib.sha256(response.content).hexdigest(), 'request_id': response.headers.get('request-id')})
            manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
            print(name + ': saved (' + str(len(response.content)) + ' bytes)', flush=True)
        except requests.RequestException as exc:
            print(name + ': transport ' + type(exc).__name__ + ', no automatic retry', flush=True)
            manifest['assets'].append({'name': name, 'status': 'failed', 'error': type(exc).__name__})
            manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')

if __name__ == '__main__':
    main()
