"""Package only the approved Porto map layer; never touches Costa or distant Porto assets."""
from pathlib import Path
from PIL import Image
import os, json, hashlib
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'public/assets/world/map';DOC=ROOT/'docs/world/diorama'
im=Image.open(OUT/'porto-diorama.png').convert('RGBA')
assert im.size==(1920,1200),im.size
meta=json.loads((OUT/'porto-diorama.meta.json').read_text());box=im.getchannel('A').getbbox();assert box
meta['artBounds']={'left':round(box[0]/im.width,6),'top':round(box[1]/im.height,6),'right':round(box[2]/im.width,6),'bottom':round(box[3]/im.height,6)}
original=json.loads((DOC/'porto-prototype-approved.meta.json').read_text())
for key in ['nodes','routes','secretRoute','worldRoutes','camera']:assert meta[key]==original[key],f'Unexpected frozen {key} change'
# Endpoints must be exactly the corresponding projected nodes (the runtime checks 1e-5).
for i in range(4):
 pts=meta['routes'][f'{i}:{i+1}']
 for p,k in [(pts[0],f'2-{i+1}'),(pts[-1],f'2-{i+2}')]:assert all(p[c]==meta['nodes'][k][c] for c in ('x','y'))
for p,k in [(meta['secretRoute'][0],'2-3'),(meta['secretRoute'][-1],'2-5')]:assert all(p[c]==meta['nodes'][k][c] for c in ('x','y'))
audit=meta['auditSummary'];projected=meta['projectedAuditSummary']
assert audit['headroomRayCount']>0 and audit['supportRayCount']>0 and projected['sampleCount']>0,'Porto audit samples missing'
assert audit['obstructionCount']==0 and audit['unsupportedCount']==0 and projected['conflictCount']==0,'Porto audit must pass before packaging'
# Validate all frozen coordinates and audit gates before replacing any derived asset.
for suffix,opts in [('webp',dict(quality=91,method=6,exact=True)),('lossless.webp',dict(lossless=True,method=6,exact=True))]:
 target=OUT/f'porto-diorama.{suffix}';temporary=OUT/f'.porto-diorama.{suffix}.tmp';im.save(temporary,'WEBP',**opts);os.replace(temporary,target)
im.resize((960,600),Image.Resampling.LANCZOS).save(OUT/'porto-diorama-preview.png')
tmp=OUT/'.porto-diorama.meta.json.tmp';tmp.write_text(json.dumps(meta,indent=2)+'\n');os.replace(tmp,OUT/'porto-diorama.meta.json')
files={n:(OUT/n).stat().st_size for n in ['porto-diorama.png','porto-diorama.webp','porto-diorama.lossless.webp','porto-diorama.meta.json']}
record={'world':2,'canvas':[1920,1200],'rgba':True,'alphaBounds':list(box),'runtimeBytes':files['porto-diorama.webp']+files['porto-diorama.meta.json'],'files':files,'sha256':{n:hashlib.sha256((OUT/n).read_bytes()).hexdigest() for n in files},'canonicalSource':'tools/diorama/render_porto_map.py'}
(DOC/'porto-art-manifest.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record,indent=2))
