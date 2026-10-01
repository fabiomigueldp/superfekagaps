"""Classify actual source sprite cells in an existing stationary projection report."""
import argparse,json,math,collections
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('label');p.add_argument('--root',required=True);a=p.parse_args();root=Path(a.root);src=json.loads((root/'serra-audit-sprite-source.json').read_text());data=json.loads((root/('serra-audit-billboard-'+a.label+'.json')).read_text());groups={}
for hit in data['contacts']:
 if not hit['phaseAvailable']:continue
 px,py=hit['pixelRelativeToFoot'];rc=math.floor(px+8);row=math.floor(26-py)
 for frame in hit['frames']:
  flip=frame.endswith('Left');fn=frame[:-4] if flip else frame[:-5];col=15-rc if flip else rc;hy=1 if fn in ['walk2','walk5'] else 0
  if not(0<=row<len(src['frames'][fn]) and 0<=col<len(src['frames'][fn][row])):continue
  ch=src['frames'][fn][row][col]
  if ch=='_' or not(row<=hy+11 and 3<=col<=14):continue
  key=(hit['route'],hit['segment'],hit['t'],tuple(hit['world']),hit['object'],frame)
  g=groups.setdefault(key,{'head':set(),'face':set(),'hit':hit});g['head'].add((row,col))
  if ch in 'SsL':g['face'].add((row,col))
records=[]
for (route,segment,t,world,obj,frame),g in groups.items():
 records.append({'route':route,'segment':segment,'t':t,'world':list(world),'object':obj,'frame':frame,'headPixelCount':len(g['head']),'faceSkinPixelCount':len(g['face']),'headSourceCoordinates':sorted(g['head']),'faceSourceCoordinates':sorted(g['face'])})
byobj=collections.defaultdict(list)
for r in records:byobj[r['object']].append(r)
summary=[]
for obj,rs in byobj.items():
 summary.append({'object':obj,'routes':sorted(set(r['route'] for r in rs)),'headContactPositions':len(set((r['route'],r['segment'],r['t']) for r in rs)),'faceContactPositions':len(set((r['route'],r['segment'],r['t']) for r in rs if r['faceSkinPixelCount'])),'first':rs[0],'worst':max(rs,key=lambda r:(r['faceSkinPixelCount'],r['headPixelCount'])),'idleRightWorst':max((r for r in rs if r['frame']=='idleRight'),key=lambda r:(r['faceSkinPixelCount'],r['headPixelCount']),default=None),'idleLeftWorst':max((r for r in rs if r['frame']=='idleLeft'),key=lambda r:(r['faceSkinPixelCount'],r['headPixelCount']),default=None)})
report={'stamp':data['stamp'],'method':'Reclassifies the actual source-cell identities of previously ray-tested center plus four inset-corner samples. Head uses authored source rows 0..11 (1..12 on bobbed frames) and canonical columns3..14; face uses skin palette symbols S,s,L. All source frames and both facings. Unavailable berth routes excluded.','passed':not records,'objects':summary,'records':records}
(root/('serra-audit-head-'+a.label+'.json')).write_text(json.dumps(report,indent=2));print(json.dumps({'label':a.label,'passed':not records,'objects':[{'object':r['object'],'headPositions':r['headContactPositions'],'facePositions':r['faceContactPositions'],'worst':{k:r['worst'][k] for k in ['route','world','frame','headPixelCount','faceSkinPixelCount']}} for r in summary]},indent=2))
