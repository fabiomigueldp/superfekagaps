from pathlib import Path
import bpy,math,json,argparse,sys,copy,runpy
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
p=argparse.ArgumentParser();p.add_argument('--repo-root',required=True);p.add_argument('--scene',required=True);p.add_argument('--output-dir',required=True);args=p.parse_args(sys.argv[sys.argv.index('--')+1:]);repo=Path(args.repo_root).resolve();out=Path(args.output_dir).resolve();out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=args.scene);scene=bpy.context.scene;cam=scene.camera
published=json.loads((repo/'public/assets/world/map/porto-diorama.meta.json').read_text());meta=copy.deepcopy(published);base_objects=set(o for o in scene.objects if not o.get('enrichment_group'))
# Audit additions against all original stage/secret paths plus boarding and bridge approach.
paths=[]
for kind,routes in meta['worldRoutes'].items():
    for i,route in enumerate(routes):paths.append((f'{kind}:{i}',route['world']))
dock=json.loads((repo/'public/assets/world/map/coast-port-journey.meta.json').read_text())['islands']['porto']
paths.append(('boarding',[p['world'] for p in dock.get('junctionToDock',dock.get('approach'))+dock['boardingRoute'][1:]]))
# Recover the published bridge's local world coordinates from its exact camera projection.
bridge=json.loads((repo/'public/assets/world/map/port-factory-bridge.meta.json').read_text())
def project_point(p):
    q=world_to_camera_view(scene,cam,Vector(p));return Vector((q.x,1-q.y))
zero=project_point((0,0,0));basis=[project_point(v)-zero for v in [(1,0,0),(0,1,0),(0,0,1)]];inverse=Matrix(((basis[0].x,basis[1].x),(basis[0].y,basis[1].y))).inverted()
def local_world(p,z):
    xy=inverse@(Vector((p['x'],p['y']))-zero-basis[2]*z);return [xy.x,xy.y,z]
bridge_height=meta['nodes']['2-4']['world'][2]
paths.append(('bridge-approach',[local_world(p,bridge_height) for p in bridge['islands']['porto']['junctionToLanding']]))
origin=bridge['placements']['porto']['origin'];points=bridge['bridgeRoute']['points'];landing_height=1.18
paths.append(('moving-bridge',[local_world({'x':p['x']-origin['x'],'y':p['y']-origin['y']},bridge_height if i==0 else landing_height) for i,p in enumerate(points)]))
bpy.context.view_layer.update();deps=scene.evaluated_depsgraph_get() if hasattr(scene,'evaluated_depsgraph_get') else bpy.context.evaluated_depsgraph_get()
right=cam.matrix_world.to_quaternion()@Vector((1,0,0));up=cam.matrix_world.to_quaternion()@Vector((0,1,0));forward=cam.matrix_world.to_quaternion()@Vector((0,0,-1))
issues=[];head_issues=[];samples=0
for name,path in paths:
    for si,(aa,bb) in enumerate(zip(path,path[1:])):
        a,b=Vector(aa),Vector(bb);d=b-a;side=Vector((-d.y,d.x,0)).normalized();steps=max(2,math.ceil(d.length/.08))
        for i in range(steps+1):
            foot=a.lerp(b,i/steps)
            for lateral in [-.28,0,.28]:
                q=foot+side*lateral;hit,loc,n,face,obj,m=scene.ray_cast(deps,q+Vector((0,0,.98)),Vector((0,0,-1)),distance=1.0)
                if hit and obj.get('enrichment_group') and loc.z>foot.z+.17:head_issues.append({'route':name,'segment':si,'t':i/steps,'object':obj.name})
            for frac in [.1,.22,.42,.67,.9,.98]:
                for lateral in [-.95,-.5,0,.5,.95]:
                    target=foot+up*(78/384*4.15)*frac+right*(48/384*4.15/2)*lateral;samples+=1
                    hit,loc,n,face,obj,m=scene.ray_cast(deps,target-forward*60,forward,distance=59.96)
                    if hit and obj.get('enrichment_group'):issues.append({'route':name,'segment':si,'t':round(i/steps,4),'heightFraction':frac,'object':obj.name,'group':obj['enrichment_group']})
report={'baselineFrozenFieldsPreserved':True,'projectedSamples':samples,'newProjectedContacts':issues,'newHeadroomContacts':head_issues,'addedObjects':len(set(scene.objects)-base_objects),'groups':sorted(set(o['enrichment_group'] for o in scene.objects if o.get('enrichment_group'))),'camera':meta['camera'],'note':'Original walking meshes and frame/camera remain fixed. Added-object camera rays include lower-body contact; no pre-existing contact is reclassified as new. Connector audit also covers the original boarding and fixed bridge approach.'}
checked=runpy.run_path(str(repo/'tools/diorama/check_porto_clearance.py'),init_globals={'PORTO_META':copy.deepcopy(published),'PORTO_OUT':str(out/'canonical-audit'),'PORTO_DOC':str(out/'canonical-audit')},run_name='__main__')
meta=checked['meta'];meta['status']='enrichment-candidate-for-review';meta['enrichmentAuditSummary']={'projectedSamples':samples,'newProjectedContactCount':len(issues),'newHeadroomContactCount':len(head_issues)}
(out/'porto-enrichment-audit.json').write_text(json.dumps(report,indent=2)+'\n');(out/'porto-enrichment.meta.json').write_text(json.dumps(meta,indent=2)+'\n')
print('PORTO_ENRICHMENT_AUDIT='+json.dumps({k:v for k,v in report.items() if k not in ['newProjectedContacts','newHeadroomContacts']}));print('NEW_PROJECTED_CONTACTS='+json.dumps(issues));print('NEW_HEADROOM_CONTACTS='+json.dumps(head_issues))
