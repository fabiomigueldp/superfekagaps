"""Focused evaluated geometry checks for new docks/boat and old Reserva paths.

blender -b SCRATCH/reserva-dominio-docks.blend -P tools/diorama/check_reserva_dominio_docks.py
No unchanged aggregate scene rebuild or render is performed by this checker.
"""
from pathlib import Path
import argparse, collections, hashlib, json, math, subprocess, sys
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--output',type=Path);p.add_argument('--step',type=float,default=.10)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
scene=bpy.context.scene;meta=json.loads(scene['reserva_dominio_metadata']);old=json.loads(scene['reserva_metadata']);dominio=json.loads((Path(bpy.data.filepath).parent/'dominio-source/dominio-prototype.meta.json').read_text())
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()

def evaluated(objects):
    vs,ts,names=[],[],[]
    for o in objects:
        ev=o.evaluated_get(deps);m=ev.to_mesh();m.calc_loop_triangles();start=len(vs);vs += [o.matrix_world@v.co for v in m.vertices];ts += [tuple(start+j for j in t.vertices) for t in m.loop_triangles];names += [o.name]*len(m.loop_triangles);ev.to_mesh_clear()
    return vs,ts,names

def tree(data):return BVHTree.FromPolygons(data[0],data[1],all_triangles=True)
def sample(path,step):
    for segment,(a,b) in enumerate(zip(path,path[1:])):
        a,b=Vector(a),Vector(b);n=max(1,math.ceil((b-a).length/step))
        for i in range(n+1):yield a.lerp(b,i/n),segment,i/n
objects=[o for o in scene.objects if o.type in {'MESH','CURVE','FONT'}]
static_objs=[o for o in objects if not o.get('ferry_boat') and not o.get('proof_actor') and not o.get('water_holdout') and not o.get('dock_group','').endswith('-gate')]
static=evaluated(static_objs);static_bvh=tree(static)
new=evaluated([o for o in static_objs if o.get('dock_group')]);new_bvh=tree(new)
walk=evaluated([o for o in static_objs if o.get('walk_support') or 'walk_' in o.name]);walk_bvh=tree(walk)
boat=evaluated([o for o in objects if o.get('ferry_boat')]);boat_origin=Vector(meta['geometry']['boatLocalFoot'])

def posed(foot,heading):
    rot=Matrix.Rotation(heading*math.tau/8,3,'Z');offset=Vector(foot)-rot@boat_origin
    return [rot@v+offset for v in boat[0]],boat[1],boat[2]

support_issues=[];support_count=0;physical=[]
right=scene.camera.rotation_euler.to_matrix()@Vector((1,0,0))
for island in ['reserva','dominio']:
    berth=tree(posed(meta['geometry']['feet'][island],6))
    for kind in ['approaches','boardingRoutes']:
        for foot,segment,t in sample(meta['geometry'][kind][island],.065):
            # The source-authored sprite is .48wide. Full disk samples also
            # cover longitudinal corner footprints, not merely the centerline.
            for dx,dy in [(0,0),(.24,0),(-.24,0),(0,.18),(0,-.18),(.17,.12),(-.17,-.12)]:
                q=foot+Vector((dx,dy,0));r=q+Vector((0,0,.20));hits=[walk_bvh.ray_cast(r,Vector((0,0,-1)),.40)]
                if kind=='boardingRoutes':hits.append(berth.ray_cast(r,Vector((0,0,-1)),.40))
                good=[h for h in hits if h[0] is not None and foot.z-.18<=h[0].z<=foot.z+.18]
                if not good:
                    # A real1–2cm boat/landing gap is smaller than the sole,
                    # but must have grounded surfaces on both sides nearby.
                    gaps=[]
                    for off in [-.025,.025]:
                        h1=walk_bvh.ray_cast(r+Vector((off,0,0)),Vector((0,0,-1)),.40)
                        h2=berth.ray_cast(r+Vector((off,0,0)),Vector((0,0,-1)),.40) if kind=='boardingRoutes' else (None,)
                        gaps.append(any(h[0] is not None and foot.z-.18<=h[0].z<=foot.z+.18 for h in [h1,h2]))
                    if not all(gaps):support_issues.append({'island':island,'kind':kind,'segment':segment,'t':t,'foot':list(foot),'offset':[dx,dy]})
                support_count+=1
            for h in [.18,.48,.85,1.10]:
                for axis in [Vector((1,0,0)),Vector((-1,0,0)),Vector((0,1,0)),Vector((0,-1,0))]:
                    hit=static_bvh.ray_cast(foot+Vector((0,0,h)),axis,.23)
                    if hit[0] is not None:physical.append({'island':island,'kind':kind,'segment':segment,'t':t,'height':h,'object':static[2][hit[2]]})
# Actual evaluated boat triangles swept in all8 heading silhouettes. Docked poses
# use heading6; detached knots are where turns are possible. Both travel
# directions and full-turn states are checked through the open-water middle leg.
boat_contacts=[];hull_count=0;sea=meta['sailRoute']['world']
for foot,segment,t in sample(sea,a.step):
    headings=range(8) if segment==1 else [6]
    for heading in headings:
        data=posed(foot,heading);moving=tree(data);contacts=collections.defaultdict(set)
        for moving_i,fixed_i in moving.overlap(static_bvh):contacts[static[2][fixed_i]].add(boat[2][moving_i])
        for name,parts in contacts.items():boat_contacts.append({'segment':segment,'t':t,'heading':heading,'object':name,'parts':sorted(parts)})
        hull_count+=1
# Exercise the actual120ms discrete heading easing along the inverse projected
# arc length used by runtime. This includes the .65s final docking turn, rather
# than assuming that every lateral pose remains frame6 during reverse arrival.
time_contacts=[];time_count=0
screen=meta['sailRoute']['points'];native_lengths=[math.hypot((b['x']-a['x'])*1.6,b['y']-a['y']) for a,b in zip(screen,screen[1:])];total=sum(native_lengths)
for direction in [1,-1]:
    points=sea if direction==1 else list(reversed(sea));lengths=native_lengths if direction==1 else list(reversed(native_lengths));headings=meta['sailRoute']['segmentHeadings'] if direction==1 else meta['sailRoute']['reverseSegmentHeadings']
    current=6;changed=0;duration=meta['sailRoute']['durationSeconds']
    for frame in range(math.ceil(duration*30)+1):
        now=min(duration,frame/30);remaining=duration-now;distance=now/duration*total;segment=0
        while segment<len(lengths)-1 and distance>lengths[segment]:distance-=lengths[segment];segment+=1
        foot=Vector(points[segment]).lerp(Vector(points[segment+1]),min(1,distance/lengths[segment]));target=6 if remaining<.65 else headings[segment]
        if current!=target and now-changed>=.12:
            turn=(target-current+8)%8;current=(current+(1 if turn<=4 else -1))%8;changed=now
        if now>=duration:current=6
        posed_data=posed(foot,current);contacts=collections.defaultdict(set)
        for moving_i,fixed_i in tree(posed_data).overlap(static_bvh):contacts[static[2][fixed_i]].add(boat[2][moving_i])
        for name,parts in contacts.items():time_contacts.append({'direction':direction,'seconds':now,'heading':current,'object':name,'parts':sorted(parts)})
        time_count+=1
# Match the actual original source pixels, upright in the world with correct
# native pixel scale. Sole contact below .12 is tracked separately from body.
sprite=json.loads(subprocess.check_output(['node',str(ROOT/'tools/diorama/export_serra_sprite.mjs')],text=True));pixel=sprite['pixelMapWidth']*20.6
basis=scene.camera.rotation_euler.to_matrix();up=basis@Vector((0,1,0));toward=basis@Vector((0,0,1));pixels=[(x,y) for y,row in enumerate(sprite['frames']['idle']) for x,s in enumerate(row) if s!='_']
def visibility(paths,obstacle,names):
    issues=[];count=0
    for label,path in paths:
        for foot,segment,t in sample(path,.15):
            heads,bodies=set(),set()
            for x,y in pixels:
                q=foot+right*((x-7.5)*pixel)+Vector((0,0,(25.5-y)*pixel/up.z))+toward*.02
                hit=obstacle.ray_cast(q,toward,100)
                if hit[0] is None:continue
                if y<12:heads.add(names[hit[2]])
                elif hit[0].z>foot.z+.12:bodies.add(names[hit[2]])
            if heads or bodies:issues.append({'route':label,'segment':segment,'t':t,'head':sorted(heads),'body':sorted(bodies)})
            count+=1
    return {'poseCount':count,'issueCount':len(issues),'issues':issues}
paths=[(island+' '+kind,path) for kind in ['approaches','boardingRoutes'] for island,path in meta['geometry'][kind].items()]+[('sailing',sea)]
vis=visibility(paths,static_bvh,static[2])
oldpaths=[('reserva '+kind+str(i),r['world']) for kind,routes in old['worldRoutes'].items() for i,r in enumerate(routes)]
oldpaths += [('reserva heated reservation',old['futureExit']['approach'])]
oldvis=visibility(oldpaths,new_bvh,new[2])
# Preserve every released asset for worlds1–5 and the original source builders.
protected=subprocess.check_output(['git','diff','--name-only','319ecf9','--','public/assets/world/map/costa*','public/assets/world/map/porto*','public/assets/world/map/fabrica*','public/assets/world/map/serra*','public/assets/world/map/reserva-diorama*','public/assets/world/map/reserva-passenger*','tools/diorama/render_reserva_map.py'],cwd=ROOT,text=True).splitlines()
sha={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest for name,digest in meta['sources'].items()}
report={'passed':not(support_issues or physical or boat_contacts or time_contacts or vis['issueCount'] or oldvis['issueCount'] or protected) and all(sha.values()) and all(meta['preservation'].values()),
        'scope':'Only new Reserva/Domínio docks, fixed source approaches, reused8-heading boat and old Reserva preservation',
        'support':{'sampleCount':support_count,'failureCount':len(support_issues),'failures':support_issues},
        'bodyClearance':{'failureCount':len(physical),'failures':physical},
        'boatSweep':{'poseCount':hull_count,'failureCount':len(boat_contacts),'failures':boat_contacts},
        'runtimeHeadingSweep':{'poseCount':time_count,'failureCount':len(time_contacts),'failures':time_contacts},
        'actorVisibility':vis,'oldReservaActorPreservation':oldvis,
        'preservation':{**meta['preservation'],'sourceHashes':sha,'protectedChanged':protected}}
out=a.output or Path(bpy.data.filepath).parent/'reserva-dominio-docks.audit.json';out.write_text(json.dumps(report,indent=2)+'\n')
print('RESERVA_DOMINIO_AUDIT='+json.dumps({k:(v if not isinstance(v,dict) else {kk:vv for kk,vv in v.items() if kk not in ['failures','issues']}) for k,v in report.items()}),flush=True)
if not report['passed']:raise SystemExit(1)
