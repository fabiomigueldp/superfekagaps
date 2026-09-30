"""Add and verify bounded embarkation connectors using the accepted island sources.

blender -b -t 8 -P tools/diorama/render_journey_docks.py -- costa [--render]
blender -b -t 8 -P tools/diorama/render_journey_docks.py -- porto [--render]

Builds the canonical scene without running its publication/render tail. Existing
assets and metadata are never overwritten. New geometry is rendered as a same-
camera transparent overlay. World coordinates remain local to each island.
"""
import bpy, os, sys, json, math, hashlib
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
ISLAND='porto' if 'porto' in sys.argv else 'costa'
TEMP=f'/tmp/feka-journey/{ISLAND}'
os.makedirs(TEMP,exist_ok=True)
source_path=os.path.join(ROOT,'tools/diorama', 'render_costa.py' if ISLAND=='costa' else 'render_porto_map.py')
original_path=os.path.join(ROOT,'public/assets/world/map',ISLAND+'-diorama.meta.json')
original=json.load(open(original_path))
source=open(source_path).read()
marker="with open(os.path.join(OUT,'costa-diorama.meta.json')" if ISLAND=='costa' else '# Audit this build'
assert marker in source, 'Canonical publication boundary changed; do not run an unbounded source script'
namespace={'__file__':source_path,'__name__':'journey_canonical_scene'}
exec(compile(source.split(marker)[0],source_path,'exec'),namespace)
scene=bpy.context.scene;cam=scene.camera
current=namespace['metadata'] if ISLAND=='costa' else namespace['meta']
for key in ['nodes','routes','secretRoute','worldRoutes','camera']:
    assert current[key]==original[key],f'Canonical {ISLAND} {key} drifted'
base_objects=set(scene.objects)
wood=namespace['woodlight'];dark=namespace.get('wooddark',namespace['wood']);rope=namespace['rope'];iron=namespace.get('iron',namespace.get('steel'))

def mesh(name,verts,faces,material):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    o=bpy.data.objects.new('journey_'+name,data);bpy.context.collection.objects.link(o);o.data.materials.append(material)
    bevel=o.modifiers.new('worked timber corners','BEVEL');bevel.width=.009;bevel.segments=2
    o.modifiers.new('weighted normals','WEIGHTED_NORMAL');return o
def beam(name,a,b,r,material):
    a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=r,depth=(b-a).length,location=(a+b)/2)
    o=bpy.context.object;o.name='journey_'+name;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();o.data.materials.append(material);return o
def slab(name,a,b,width=.76,stairs=False,rails=False):
    # The exported line is 0.04 above the physical walking surface, as in the
    # original route exports. Shared tread edges give continuous support.
    a,b=Vector(a)-Vector((0,0,.04)),Vector(b)-Vector((0,0,.04))
    d=b-a;side=Vector((-d.y,d.x,0)).normalized();steps=max(1,math.ceil(abs(d.z)/.115)) if stairs else 1
    for i in range(steps):
        aa=a.lerp(b,i/steps);bb=a.lerp(b,(i+1)/steps);z=(aa.z+bb.z)/2 if stairs else None
        top=[aa-side*width/2,aa+side*width/2,bb+side*width/2,bb-side*width/2]
        if stairs:top=[Vector((p.x,p.y,z)) for p in top]
        bottom=[p-Vector((0,0,.14)) for p in top]
        mesh(name+' supported '+('tread' if stairs else 'deck'),[tuple(p) for p in top+bottom],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],wood)
    for sign in [-1,1]:
        off=side*sign*(width/2-.065)
        beam(name+' underside bearer',a+off-Vector((0,0,.16)),b+off-Vector((0,0,.16)),.065,dark)
        for t in [0,.5,1]:
            p=a.lerp(b,t)+off
            beam(name+' timber pile',(p.x,p.y,.04),(p.x,p.y,p.z-.16),.055,dark)
        if rails:
            off=side*sign*(width/2+.07)
            pa=a.lerp(b,.15)+off;pb=a.lerp(b,.85)+off
            beam(name+' handrail',pa+Vector((0,0,.62)),pb+Vector((0,0,.62)),.023,rope)
            for p in [pa,pb]:beam(name+' handrail upright',p,p+Vector((0,0,.66)),.04,dark)
    # Narrow cross-grain board joints; actual support comes from the slab above.
    if not stairs:
        for i in range(max(1,int(d.length/.25))):
            p=a.lerp(b,(i+.5)/max(1,int(d.length/.25)))+Vector((0,0,.006))
            beam(name+' board joint',p-side*(width/2-.025),p+side*(width/2-.025),.006,dark)

if ISLAND=='costa':
    # Main 1-3↔1-4, segment 3, t=.5. This is a real tread on the
    # already-supported east stair, not the inaccessible cliff-side shore.
    join=(3.40,-3.045,1.60)
    # Raised west crossing keeps the existing front pile out of Feka's face
    # in projection, then two shallow pieces meet the untouched dock height.
    spur=[join,(3.40,-3.53,1.60),(4.50,-4.66,.98),(5.15,-4.66,.98),(5.56,-4.66,.84),(5.56,-4.38,.695)]
    for i,(a,b) in enumerate(zip(spur,spur[1:])):slab('Costa fishers access',a,b,.80,stairs=i==1,rails=i==1)
    # Square landings close the outside of both stair turns; no triangular
    # unsupported wedge is hidden underneath a route interpolation.
    for x,y,z in spur[1:3]:slab('Costa stair turn landing',(x-.25,y,z+.008),(x+.25,y,z+.008),.50)
    x,y,z=spur[-2];slab('Costa dock turn landing',(x-.25,y,z+.008),(x+.25,y,z+.008),.50)
    # Accessible original southern end; northern barrels and side ropes remain.
    dock=spur[-1];passenger=(5.56,-5.53,.600)
    gangway=[dock,spur[-2],(5.56,-5.08,.84),passenger]
    # The first segment is the same physical dock ramp as the final spur.
    # Reuse its surface; duplicate coplanar meshes cause black render patches.
    for a,b in list(zip(gangway,gangway[1:]))[1:]:slab('Costa boarding gangway',a,b,.59)
    main=original['worldRoutes']['main'][2]['world']
    approach=[main[-1],*reversed(main[4:-1]),list(join),*spur[1:]]
    berth={'headingFrame':0,'passengerWorld':list(passenger),'waterlineWorld':[5.34,-5.53,.030]}
    join_data={'route':'2:3','from':'1-3','to':'1-4','worldSegment':3,'segment':3,'t':.5,'world':list(join)}
    # No camera/model edit. The tiny extents below the existing 8:5 canvas are
    # captured by a crop export described in the metadata rather than clipping.
else:
    # Open west edge of the existing arrival deck. The boat remains west of
    # the scenic tug, whose hull is x=-5.38..-3.23 at y≈-4.46.
    dock=(-6.06,-2.83,.992);passenger=(-7.08,-2.83,.600)
    approach=[original['nodes']['2-1']['world'],dock]
    gangway=[dock,(-6.48,-2.83,.820),passenger]
    for a,b in zip(gangway,gangway[1:]):slab('Porto west boarding gangway',a,b,.64)
    berth={'headingFrame':2,'passengerWorld':list(passenger),'waterlineWorld':[-7.08,-3.05,.030]}
    join_data={'node':'2-1','world':original['nodes']['2-1']['world']}

bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
def project(co):
    p=world_to_camera_view(scene,cam,Vector(co));return {'x':round(p.x,6),'y':round(1-p.y,6)}
def audit_path(points,half_width=.18):
    issues=[];samples=0;support_objects=set()
    for si,(aa,bb) in enumerate(zip(points,points[1:])):
        a,b=Vector(aa),Vector(bb);delta=b-a;side=Vector((-delta.y,delta.x,0)).normalized();count=max(2,math.ceil(delta.length/.07))
        for i in range(count+1):
            p=a.lerp(b,i/count)
            for off in [-half_width,0,half_width]:
                q=p+side*off;samples+=1
                hit,loc,normal,face,obj,matrix=scene.ray_cast(deps,q+Vector((0,0,.14)),Vector((0,0,-1)),distance=.37)
                if not hit or abs(loc.z-q.z)>.20:issues.append({'type':'support','segment':si,'t':round(i/count,3),'side':off,'world':list(q),'hit':obj.name if hit else None})
                else:support_objects.add(obj.name)
                hit,loc,normal,face,obj,matrix=scene.ray_cast(deps,q+Vector((0,0,.21)),Vector((0,0,1)),distance=.96)
                if hit:issues.append({'type':'headroom','segment':si,'t':round(i/count,3),'side':off,'world':list(q),'hit':obj.name})
    return {'sampleCount':samples,'supportRayCount':samples,'headroomRayCount':samples,'issueCount':len(issues),'issues':issues,'supportObjects':sorted(support_objects)}

audits={'approach':audit_path(approach),'gangway':audit_path(gangway,.16)}
# Existing main/secret paths are audited again, with identical metadata, after
# additions. For Costa use its established allowance at wide stair corners.
existing={}
for kind,routes in original['worldRoutes'].items():
    for index,route in enumerate(routes):existing[f'{kind}:{index}']=audit_path(route['world'],.10 if kind=='secret' else .16)
new_objects=[o for o in scene.objects if o not in base_objects]
for o in new_objects:o.hide_viewport=True
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
baseline={}
for kind,routes in original['worldRoutes'].items():
    for index,route in enumerate(routes):baseline[f'{kind}:{index}']=audit_path(route['world'],.10 if kind=='secret' else .16)
for o in new_objects:o.hide_viewport=False
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
new_existing_issues={key:[issue for issue in value['issues'] if issue not in baseline[key]['issues']] for key,value in existing.items()}
meta={'version':1,'island':ISLAND,'source':os.path.relpath(source_path,ROOT),'sourceSha256':hashlib.sha256(source.encode()).hexdigest(),'coordinateSystem':'Normalized accepted island 1920x1200 top-left frame; positions outside 0..1 are valid in the continuous world. World XYZ are local to this island.','camera':original['camera'],'size':original['size'],'join':join_data,'dock':{**project(dock),'world':list(dock)},'approach':[{**project(p),'world':list(p)} for p in approach],'boardingRoute':[{**project(p),'world':list(p)} for p in gangway],'berth':{**berth,'passenger':project(berth['passengerWorld']),'waterline':project(berth['waterlineWorld'])},'audit':audits,'existingRouteAudit':existing,'frozenFields':['nodes','routes','secretRoute','worldRoutes','camera'],'existingFieldsUnchanged':True,'newGeometryObjects':len(new_objects)}
meta['join'].update(project(join_data['world']))
meta['junctionToDock']=[{**project(p),'world':list(p)} for p in (spur if ISLAND=='costa' else approach)]
meta['existingRouteAuditDelta']={'newIssueCount':sum(len(v) for v in new_existing_issues.values()),'newIssues':new_existing_issues,'baselineIssueCounts':{key:value['issueCount'] for key,value in baseline.items()},'note':'Same strict support/headroom method run before/after additions. Baseline Costa corner/bridge/foliage contacts belong to the accepted unchanged source; this addition must introduce zero new contacts.'}
with open(f'{TEMP}/dock.meta.json','w') as handle:json.dump(meta,handle,indent=2)
import runpy
projection=runpy.run_path(os.path.join(ROOT,'tools/diorama/check_journey_projection.py'),init_globals={'JOURNEY_ISLAND':ISLAND,'JOURNEY_META':meta})
meta=projection['meta']
if '--allow-draft' not in sys.argv:
    assert all(result['issueCount']==0 for result in audits.values()), 'New connector support/headroom audit failed'
    assert meta['existingRouteAuditDelta']['newIssueCount']==0, 'New geometry affected an accepted route'
    assert meta['projectedClearance']['upperBodyConflictCount']==0, 'Projected actor clearance failed'
    assert meta['projectedClearance']['lowerBodyContactCount']==0, 'Projected lower-body clearance failed'
print('JOURNEY_DOCK_AUDIT='+json.dumps({'island':ISLAND,'new':{k:v['issueCount'] for k,v in audits.items()},'existing':{k:v['issueCount'] for k,v in existing.items()},'dock':meta['dock'],'berth':meta['berth']}))
bpy.ops.wm.save_as_mainfile(filepath=f'{TEMP}/journey-dock.blend')
if '--render' in sys.argv:
    # Expand around the fixed camera in a deterministic 1920x1440 output.
    # The extra 120 px at top/bottom has an explicit offset in island space.
    for o in base_objects:
        if o.type in {'MESH','CURVE'}:o.is_holdout=True
    scene.render.resolution_x=1920;scene.render.resolution_y=1440;scene.render.resolution_percentage=100
    scene.cycles.samples=48;scene.cycles.use_denoising=False
    scene.render.filepath=f'{TEMP}/dock-overlay.png'
    bpy.ops.render.render(write_still=True)
    meta['overlay']={'renderSize':{'width':1920,'height':1440},'islandFrame':{'x':0,'y':-.1,'width':1,'height':1.2},'path':f'/assets/world/map/{ISLAND}-journey-dock.webp'}
    with open(f'{TEMP}/dock.meta.json','w') as handle:json.dump(meta,handle,indent=2)
