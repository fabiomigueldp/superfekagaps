"""Original Brazilian character performance using a library voice, not a clone."""
from pathlib import Path
import argparse
import json
import re
import requests

ROOT=Path(__file__).resolve().parents[2]
VOICE='CstacWqMhJQlnfLPxRG4'  # Will, Brazilian Portuguese; discovered from /v2/voices.
parser=argparse.ArgumentParser()
parser.add_argument('--key-file',required=True)
args=parser.parse_args()
raw=Path(args.key_file).read_text(encoding='utf-8-sig').strip()
match=re.search(r'(?:sk_|xi_)[A-Za-z0-9_-]{16,}',raw)
key=match.group(0) if match else raw.split('=',1)[-1].strip().strip('"\'')
if '\n' in key or len(key)<20:raise SystemExit('Key file format not recognized; no requests sent.')
headers={'xi-api-key':key,'Content-Type':'application/json'}
lines=[
    ('guina-oco','Vou te deixar oco, Feka! Você vai tomar o maior gap desta ilha!'),
    ('guina-namoro','Feka, namora comigo. Eu até divido o suco com você.'),
    ('guina-fugir','Vai fugir, Feka? Olha o gap que eu vou abrir!'),
    ('guina-reserva','Ninguém encosta na minha reserva! Pressão máxima!'),
    ('jaja-delicia','Ai, que delícia! Mas cuidado com a pressão da caneca!'),
    ('jaja-promessa','Eu prometi proteger a partilha. Acabei protegendo o portão.'),
    ('guina-final','Tá bom. Sem gap, sem ameaça. Mas ainda posso te chamar para um suco?'),
]
manifest=[]
(ROOT/'docs/world/delicia/audio').mkdir(parents=True,exist_ok=True)
for name,text in lines:
    dest=ROOT/'docs/world/delicia/audio'/f'{name}.mp3'
    if not dest.exists():
        r=requests.post('https://api.elevenlabs.io/v1/text-to-speech/'+VOICE,headers=headers,params={'output_format':'mp3_44100_128'},json={'text':text,'model_id':'eleven_multilingual_v2','language_code':'pt','voice_settings':{'stability':.42,'similarity_boost':.65,'style':.55,'use_speaker_boost':True}},timeout=90)
        if r.status_code!=200:print(name+': HTTP '+str(r.status_code),flush=True);break
        dest.write_bytes(r.content)
    manifest.append({'name':name,'file':dest.relative_to(ROOT).as_posix(),'text':text,'voice':VOICE,'model':'eleven_multilingual_v2','performance':'Original library-voice performance; not a clone of either actor.'});print(name+': ready',flush=True)
(ROOT/'docs/world/delicia/voice-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
