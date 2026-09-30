"""Gate and package only the authored world3 factory layer, leaving all other worlds alone."""
from pathlib import Path
from PIL import Image
import os,json,hashlib,math
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'public/assets/world/map';DOC=ROOT/'docs/world/diorama'
im=Image.open(OUT/'fabrica-diorama.png').convert('RGBA');assert im.size==(1920,1200),im.size
meta=json.loads((OUT/'fabrica-diorama.meta.json').read_text());assert meta['world']==3 and meta['size']=={'width':1920,'height':1200}
box=im.getchannel('A').getbbox();assert box and box[0]>0 and box[1]>0 and box[2]<im.width and box[3]<im.height,'Artwork clipped by export frame'
meta['artBounds']={'left':round(box[0]/im.width,6),'top':round(box[1]/im.height,6),'right':round(box[2]/im.width,6),'bottom':round(box[3]/im.height,6)}
reference=json.loads((DOC/'fabrica-composition-approved.meta.json').read_text())
for key in ['nodes','routes','secretRoute','worldRoutes','camera']:assert meta[key]==reference[key],f'Unexpected approved {key} change'
for i in range(4):
 pts=meta['routes'][f'{i}:{i+1}']
 for p,k in [(pts[0],f'3-{i+1}'),(pts[-1],f'3-{i+2}')]:assert all(p[c]==meta['nodes'][k][c] for c in ('x','y'))
for p,k in [(meta['secretRoute'][0],'3-3'),(meta['secretRoute'][-1],'3-5')]:assert all(p[c]==meta['nodes'][k][c] for c in ('x','y'))
audit=meta['auditSummary'];projected=meta['projectedAuditSummary']
assert audit['headroomRayCount']>0 and audit['supportRayCount']>0 and projected['sampleCount']>0
assert audit['obstructionCount']==audit['unsupportedCount']==projected['conflictCount']==0,'Clearance must pass before packaging'
assert meta['billboardAuditSummary']['sampleCount']>0 and meta['billboardAuditSummary']['equipmentContactCount']==0
meta_bytes=(json.dumps(meta,indent=2)+'\n').encode()
# All checks happen before atomically replacing runtime files. Budget is gated on
# the real optimized encoder output, not an estimate from the PNG file size.
tmp=OUT/'.fabrica-diorama.webp.tmp';im.save(tmp,'WEBP',quality=91,method=6,exact=True)
assert tmp.stat().st_size+len(meta_bytes)<350_000,'Factory runtime image + metadata exceeds350KB'
os.replace(tmp,OUT/'fabrica-diorama.webp')
im.save(OUT/'fabrica-diorama.lossless.webp','WEBP',lossless=True,method=6,exact=True)
im.resize((960,600),Image.Resampling.LANCZOS).save(OUT/'fabrica-diorama-preview.png')
tmp=OUT/'.fabrica-diorama.meta.json.tmp';tmp.write_bytes(meta_bytes);os.replace(tmp,OUT/'fabrica-diorama.meta.json')
files={name:(OUT/name).stat().st_size for name in ['fabrica-diorama.png','fabrica-diorama.webp','fabrica-diorama.lossless.webp','fabrica-diorama.meta.json']}
record={'world':3,'canvas':[1920,1200],'rgba':True,'alphaBounds':list(box),'runtimeBytes':files['fabrica-diorama.webp']+files['fabrica-diorama.meta.json'],'files':files,'sha256':{name:hashlib.sha256((OUT/name).read_bytes()).hexdigest() for name in files},'canonicalSource':'tools/diorama/render_fabrica_map.py'}
(DOC/'fabrica-art-manifest.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record,indent=2))
