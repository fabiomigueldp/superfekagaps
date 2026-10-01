"""Local, source-grounded Porto→Factory lowered cargo-bridge prototype.
No runtime files or published artifacts are edited.
"""
from pathlib import Path
import bpy,math,json,copy,sys,os
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[2];OUT=Path(os.environ.get('FEKA_BRIDGE_OUT','/tmp/feka-port-factory-bridge'));OUT.mkdir(parents=True,exist_ok=True)
REPO=ROOT
factory_source=ROOT/'tools/diorama/render_fabrica_map.py'
fns={'__file__':str(factory_source),'__name__':'source_factory'}
if '--cached-factory' in sys.argv:
    bpy.ops.wm.open_mainfile(filepath=str(OUT/'factory-source-clean.blend'))
    fns.update(cam=bpy.context.scene.camera,meta=json.loads((ROOT/'public/assets/world/map/fabrica-diorama.meta.json').read_text()))
else:
    exec(compile(factory_source.read_text().split('# Always audit fresh in-memory coordinates')[0],str(factory_source),'exec'),fns)
factory_meta=copy.deepcopy(fns['meta'])
approved=json.loads((ROOT/'docs/world/diorama/fabrica-composition-approved.meta.json').read_text())
for key in ['nodes','routes','secretRoute','worldRoutes','camera']:
    assert factory_meta[key]==approved[key],f'Factory frozen geometry drift: {key}'
factory_basis=fns['cam'].rotation_euler.to_matrix().copy();factory_cam=fns['cam'].location.copy()
def projection_coefficients(cam):
    scene=bpy.context.scene
    def p(v):
        q=world_to_camera_view(scene,cam,Vector(v));return Vector((q.x,1-q.y))
    c=p((0,0,0));d=[p(v)-c for v in [(1,0,0),(0,1,0),(0,0,1)]]
    return c,[[v.x for v in d],[v.y for v in d]]
bpy.context.view_layer.update();fc,fm=projection_coefficients(fns['cam'])
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'factory-source-clean.blend'))
port_source=REPO/'tools/diorama/render_porto_map.py'
# Read current source, but redirect its harmless mkdir calls into this prototype.
text=port_source.read_text().split('# Audit this build')[0]
text=text.replace("ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'));OUT=os.path.join(ROOT,'public/assets/world/map');DOC=os.path.join(ROOT,'docs/world/diorama')",f"ROOT={str(OUT)!r};OUT=ROOT;DOC=ROOT")
pns={'__file__':str(port_source),'__name__':'source_porto'}
exec(compile(text,str(port_source),'exec'),pns)
scene=bpy.context.scene;cam=scene.camera;port_meta=copy.deepcopy(pns['meta'])
bpy.context.view_layer.update();pc,pm=projection_coefficients(cam)
placements={'costa':{'origin':{'x':0,'y':0},'scale':1},'porto':{'origin':{'x':1.1,'y':-.12},'scale':1},'fabrica':{'origin':{'x':1.98,'y':.03},'scale':1}}
# Orthographic art cameras differ slightly. This affine registration preserves
# height and Factory projected layout while expressing both local models
# in Porto's authoring space. It never modifies their source cameras or metadata.
offset=Vector((1.98-1.1,.03-(-.12)));xy=Matrix(((pm[0][0],pm[0][1]),(pm[1][0],pm[1][1]))).inverted()
A=Matrix.Identity(4)
for j in range(3):
    rhs=Vector((fm[0][j],fm[1][j]))-(Vector((pm[0][2],pm[1][2])) if j==2 else Vector((0,0)))
    sol=xy@rhs;A[0][j]=sol.x;A[1][j]=sol.y
sol=xy@(fc+offset-pc);A[0][3]=sol.x;A[1][3]=sol.y
# Blender must not append from the file currently named by the active session.
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'porto-source-clean.blend'))
with bpy.data.libraries.load(str(OUT/'factory-source-clean.blend'),link=False) as (available,loaded):
    loaded.objects=available.objects
factory_objects=[]
for ob in loaded.objects:
    if ob and ob.type in {'MESH','CURVE','FONT','LIGHT'}:
        ob['canonical_factory_name']=ob.name
        ob.name='factory_'+ob.name;scene.collection.objects.link(ob);factory_objects.append(ob)
bpy.context.view_layer.update()
for ob in factory_objects:
        ob.matrix_world=A@ob.matrix_world.copy()
def fp(p):return A@Vector(p)
mesh=pns['mesh'];beam=pns['beam'];cube=pns['cube'];wood=pns['woodlight'];blue=pns['steel'];edge=pns['steelhi'];yellow=pns['yellow'];stone=pns['stone']
def deck(name,a,b,width=1.36,rails=False,piles=False):
    a,b=Vector(a)-Vector((0,0,.04)),Vector(b)-Vector((0,0,.04));d=b-a;side=Vector((-d.y,d.x,0)).normalized()
    v=[a-side*width/2,a+side*width/2,b+side*width/2,b-side*width/2];vs=v+[p-Vector((0,0,.18)) for p in v]
    ob=mesh('walk_bridge '+name,[tuple(p) for p in vs],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],wood);pns['bevel'](ob,.018)
    for sg in [-1,1]:
        off=side*sg*(width/2-.06)
        beam('bridge '+name+' steel girder',a+off-Vector((0,0,.19)),b+off-Vector((0,0,.19)),.085,blue)
        if piles:
            for t in [.13,.88]:
                p=a.lerp(b,t)+off;beam('bridge '+name+' rooted pile',(p.x,p.y,-.10),(p.x,p.y,p.z-.20),.08,blue)
        if rails:
            off=side*sg*(width/2+.06);pa=a.lerp(b,.10)+off;pb=a.lerp(b,.90)+off
            beam('bridge '+name+' open rail',pa+Vector((0,0,.44)),pb+Vector((0,0,.44)),.026,yellow)
            for t in [.10,.5,.90]:
                p=a.lerp(b,t)+off;beam('bridge '+name+' rail post',p,p+Vector((0,0,.47)),.032,blue)
    for i in range(max(2,int(d.length/.28))):
        p=a.lerp(b,(i+.5)/max(2,int(d.length/.28)))+Vector((0,0,.009));beam('walk_bridge '+name+' flush board seam',p-side*(width/2-.025),p+side*(width/2-.025),.006,edge)
    return side

# Exit forks from the existing lower end of the operations ramp, reached from
# 2-5 by walking the unchanged ramp. The crane load remains behind the route.
port_join=[4.575,-1.225,1.692];port_hinge=[6.72,-1.225,1.692]
port_branch=[port_join,port_hinge]
factory_landing_local=[-5.85,-4.30,1.18];factory_turn_local=[-5.25,-4.30,1.18]
factory_approach_local=[factory_landing_local,factory_turn_local,[-5.25,-3.4,1.18],factory_meta['nodes']['3-1']['world']]
factory_branch=[list(fp(p)) for p in factory_approach_local]
deck('Porto fixed approach',*port_branch,1.36,piles=True)
q=Vector(port_hinge)+Vector((0,0,.025));deck('Porto hinge turn pad',q-Vector((.45,0,0)),q+Vector((.45,0,0)),1.50,piles=True)
for i,(a,b) in enumerate(zip(factory_branch,factory_branch[1:])):deck('receiving fixed approach '+str(i),a,b,1.36,piles=i<2)
# A square receiving landing closes the inside and outside of the turn.
q=fp(factory_turn_local)+Vector((0,0,.025));deck('receiving turn pad',q-Vector((.70,0,0)),q+Vector((.70,0,0)),1.44,piles=True)
a,b=Vector(port_hinge),Vector(factory_branch[0]);side=deck('lowered moving cargo span',a,b,1.48,rails=True)
for sg in [-1,1]:
    p=a+side*sg*.87-Vector((0,0,.12))
    cube('bridge hinge concrete plinth',(p.x,p.y,.65),(.46,.46,1.30),stone,.045)
    hub=pns['cylinder']('bridge visible pivot hub',p,.19,.14,yellow,24);hub.rotation_euler=(side).to_track_quat('Z','Y').to_euler()
bridge_path=[port_join,port_hinge,*factory_branch]
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();basis=cam.rotation_euler.to_matrix();toward=basis@Vector((0,0,1));right=basis@Vector((1,0,0))
def project(p):
    q=world_to_camera_view(scene,cam,Vector(p));return {'x':round(1.1+q.x,6),'y':round(-.12+1-q.y,6)}
issues=[];contacts=[];support_count=0;projection_count=0
for si,(aa,bb) in enumerate(zip(bridge_path,bridge_path[1:])):
    a,b=Vector(aa),Vector(bb);d=b-a;side=Vector((-d.y,d.x,0)).normalized();n=max(2,math.ceil(d.length/.09))
    for i in range(n+1):
        p=a.lerp(b,i/n)
        for off in [-.28,0,.28]:
            q=p+side*off;support_count+=1
            hit,loc,normal,face,ob,matrix=scene.ray_cast(deps,q+Vector((0,0,.11)),Vector((0,0,-1)),distance=.34)
            if not hit or not ('walk_' in ob.name) or abs(loc.z-q.z)>.17:issues.append({'kind':'support','segment':si,'t':i/n,'object':ob.name if hit else None})
            hit,loc,normal,face,ob,matrix=scene.ray_cast(deps,q+Vector((0,0,.20)),Vector((0,0,1)),distance=.90)
            if hit:issues.append({'kind':'headroom','segment':si,'t':i/n,'object':ob.name})
        for off in [-.26,0,.26]:
            for height in [.22,.46,.72,.98]:
                q=p+right*off+Vector((0,0,height));projection_count+=1
                hit,loc,normal,face,ob,matrix=scene.ray_cast(deps,q+toward*.015,toward,distance=40)
                if hit:contacts.append({'segment':si,'t':round(i/n,4),'height':height,'object':ob.name})
report={'physicalSampleCount':support_count,'physicalIssueCount':len(issues),'physicalIssues':issues,'projectedSampleCount':projection_count,'projectedContactCount':len(contacts),'projectedContacts':contacts}
route=[project(p) for p in bridge_path]
record={'version':1,'status':'lowered-bridge-local-prototype','storySource':'docs/world/campanha.md:66','placements':placements,'portJoin':{'kind':'route-segment','from':'2-4','to':'2-5','worldPoint':port_join,'worldSegment':0,'t':.5,'atlas':route[0]},'factoryJoin':{'kind':'node','node':'3-1','atlas':route[-1]},'pathAtlas':route,'pathPortoAuthoringWorld':[list(p) for p in bridge_path],'factoryApproachLocal':factory_approach_local,'movingSpan':{'start':list(port_hinge),'end':factory_branch[0],'lengthWorld':round((Vector(port_hinge)-Vector(factory_branch[0])).length,4),'widthWorld':1.48,'portFootHeight':1.692,'factoryFootHeight':1.18,'deckUndersideWaterClearanceAtLowEnd':.96,'lowestGirderWaterClearanceAtLowEnd':.865,'slopeDegrees':round(math.degrees(math.atan2(.512,(Vector(port_hinge)-Vector(factory_branch[0])).xy.length)),3)},'audits':report,'registration':{'method':'height-preserving orthographic affine registration of Factory source into Porto authoring space only','factoryToPortoMatrix':[list(r) for r in A]}}
(OUT/'cargo-bridge.meta.json').write_text(json.dumps(record,indent=2)+'\n')
print('BRIDGE_AUDIT='+json.dumps(report))
# Render both islands at their precise accepted normalized placements. Camera
# resize only changes the review canvas, never their persisted source cameras.
full_width=2.08;left=-.08;top=-.10;height=1.24
old_basis=cam.rotation_euler.to_matrix();shift=old_basis@Vector(((left+full_width/2-.5)*20.6,-(top+height/2-.5)*12.875,0))
cam.location+=shift;cam.data.ortho_scale=20.6*full_width
scene.render.resolution_x=2288;scene.render.resolution_y=853;scene.render.resolution_percentage=100;scene.cycles.samples=24
scene.render.filepath=str(OUT/'port-factory-lowered-bridge.png');scene['cargo_bridge_metadata']=json.dumps(record);scene['bridge_pad_fix']=True
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'cargo-bridge.blend'));bpy.ops.render.render(write_still=True)
assert not issues,'Inspect physical route audit before review'
