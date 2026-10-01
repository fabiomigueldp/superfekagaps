import sys,runpy,json,math,collections,argparse,os
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
p=argparse.ArgumentParser();p.add_argument('--lane-spacing',type=float);p.add_argument('--label',default='latest');p.add_argument('--step',type=float,default=.0005);p.add_argument('--scenery',action='store_true')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
sys.argv=['raster','--','--label',a.label+'-source','--step',str(a.step)]
if a.lane_spacing is not None:sys.argv+=['--lane-spacing',str(a.lane_spacing)]
if a.scenery:sys.argv+=['--scenery']
g=runpy.run_path(os.path.join(os.path.dirname(__file__),'check_serra_rider_occlusion.py'));spacing=a.lane_spacing or g['ride']['laneDistance']
source=g['src'];cells={}
for fn,rows in source['frames'].items():
 hy=1 if fn in ['walk2','walk5'] else 0
 for flip in [False,True]:
  for y,row in enumerate(rows):
   for x,ch in enumerate(row):
    if ch=='_' or not(y<=hy+11 and 3<=x<=14):continue
    key=(15-x if flip else x,y);cells[key]=cells.get(key,False) or ch in 'SsL'
profiles=[('desktop',1180,757,1),('portrait',400,606,1.05),('landscape',846,392,1)];results=[];N=math.ceil(1/a.step);W=g['cam'].data.ortho_scale
for name,w,h,zoom in profiles:
 C=min(w/1.6,h)*1.6*zoom;scale=C*source['pixelMapWidth'];size=math.ceil(scale)
 for lane in [0,1]:
  records=[];model=g['models']['B' if lane==0 else'A']
  for i in range(N+1):
   t=i/N;foot=g['foot'](lane,t);counter=g['foot'](1-lane,1-t);proj=world_to_camera_view(g['scene'],g['cam'],foot);fx=(proj.x-.5)*C+w/2;fy=(.5-proj.y)*C/1.6+h/2;pts={}
   for(sx,sy),face in cells.items():
    x0=math.floor(fx+(sx-8)*scale+.5);y0=math.floor(fy+(sy-26)*scale+.5)
    for dx in range(size):
     for dy in range(size):key=(x0+dx+.5,y0+dy+.5);pts[key]=pts.get(key,False)or face
   objs=collections.Counter();faces=0;heads=0
   for(x,y),face in pts.items():
    q=foot-counter+g['right']*((x-fx)/C*W)+Vector((0,0,(fy-y)/C*W/g['up'].z));loc,n,idx,d=model['bvh'].ray_cast(q+g['toward']*.012,g['toward'],40)
    hitname=model['names'][idx] if loc is not None else None
    if a.scenery:
     own=g['models']['A' if lane==0 else 'B'];offset=q-foot+counter
     for geometry,origin in [(own,offset),(g['static_model'],foot+offset)]:
      ll,nn,ii,dd=geometry['bvh'].ray_cast(origin+g['toward']*.012,g['toward'],40)
      if ll is not None and (hitname is None or dd<d):hitname=geometry['names'][ii];d=dd
    if hitname is not None:heads+=1;faces+=face;objs[hitname]+=1
   if heads:records.append({'t':t,'headCssPixels':heads,'faceCssPixels':faces,'objects':dict(objs),'riderFoot':list(foot),'countercarFoot':list(counter)})
  results.append({'profile':name,'viewport':[w,h],'zoom':zoom,'lane':lane,'sampleCount':N+1,'headContactPoses':len(records),'faceContactPoses':sum(r['faceCssPixels']>0 for r in records),'first':records[0]if records else None,'last':records[-1]if records else None,'maximumHeadCssPixels':max([r['headCssPixels']for r in records]or[0]),'maximumFaceCssPixels':max([r['faceCssPixels']for r in records]or[0]),'records':records})
  print('RASTER_PROGRESS='+json.dumps({k:v for k,v in results[-1].items()if k!='records'}),flush=True)
report={'stamp':g['stamp'],'laneSpacing':spacing,'simulationOnly':a.lane_spacing is not None,'includesSceneryAndOwnCarrier':a.scenery,'method':'Exact real-source rounded/ceil head and face opaque CSS pixel centers, union of 7 frames and 2 facings, against actual countercar mesh throughout both lanes. Reverse travel traverses identical states in reverse order. Camera phase fixed to image center. Actual embedded paths unless explicit spacing simulation is requested. No scene saved.','results':results}
json.dump(report,open(os.path.join(g['OUT'],'serra-audit-rider-raster-'+a.label+'.json'),'w'),indent=2)
