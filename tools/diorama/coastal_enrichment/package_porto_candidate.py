"""Package only an audited Porto candidate into an explicit scratch destination."""
from pathlib import Path
from PIL import Image
import argparse,json,hashlib
p=argparse.ArgumentParser();p.add_argument('--repo-root',required=True);p.add_argument('--image',required=True);p.add_argument('--audit-dir',required=True);p.add_argument('--output-dir',required=True);a=p.parse_args()
repo=Path(a.repo_root).resolve();out=Path(a.output_dir).resolve();audits=Path(a.audit_dir).resolve();out.mkdir(parents=True,exist_ok=True)
published=json.loads((repo/'public/assets/world/map/porto-diorama.meta.json').read_text());meta=json.loads((audits/'porto-enrichment.meta.json').read_text());audit=json.loads((audits/'porto-enrichment-audit.json').read_text())
for key in ['nodes','routes','secretRoute','worldRoutes','camera','size']:assert meta[key]==published[key],key
assert not audit['newProjectedContacts'] and not audit['newHeadroomContacts']
assert meta['auditSummary']['obstructionCount']==0 and meta['auditSummary']['unsupportedCount']==0 and meta['projectedAuditSummary']['conflictCount']==0
im=Image.open(a.image).convert('RGBA');assert im.size==(1920,1200)
alpha=im.getchannel('A');bounds=alpha.getbbox();assert bounds
edges={name:alpha.crop(rect).getextrema()[1] for name,rect in [('top',(0,0,1920,2)),('left',(0,0,2,1200)),('bottom',(0,1198,1920,1200)),('right',(1918,0,1920,1200))]};assert max(edges.values())==0
meta['artBounds']={'left':round(bounds[0]/1920,6),'top':round(bounds[1]/1200,6),'right':round(bounds[2]/1920,6),'bottom':round(bounds[3]/1200,6)}
meta['status']='enrichment-candidate-for-review';meta['enrichmentSources']=['enrich_porto.py','package_porto_candidate.py']
path=out/'porto-diorama.webp';im.save(path,'WEBP',quality=91,method=6,exact=True)
metadata=out/'porto-diorama.meta.json';metadata.write_text(json.dumps(meta,indent=2)+'\n')
receipt={'world':2,'frame':[1920,1200],'baselineFieldsPreserved':['nodes','routes','secretRoute','worldRoutes','camera','size'],'alphaBounds':list(bounds),'edgeAlphaMax':edges,'newProjectedRayCount':audit['projectedSamples'],'newProjectedContactCount':0,'newHeadroomContactCount':0,'canonicalSupportAndHeadroom':meta['auditSummary'],'canonicalLoadProjection':meta['projectedAuditSummary'],'runtimeBytes':path.stat().st_size+metadata.stat().st_size,'files':{f.name:{'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in [path,metadata]},'baselineImageSha256':hashlib.sha256((repo/'public/assets/world/map/porto-diorama.webp').read_bytes()).hexdigest(),'note':'Scratch candidate only. Native camera and original walk geometry, published route controls, boarding and bridge contract stay fixed. Added hull/sea silhouette still requires the focused ferry alpha check before integration.'}
(out/'porto-enrichment-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2))
