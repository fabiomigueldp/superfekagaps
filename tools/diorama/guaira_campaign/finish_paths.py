"""Revision 6, starting from the saved revision 5 guaira-entrances.blend.

Run inspect_path_finish.py and layout_path_finish.py first. --draft makes a
preview. --no-render only saves. Navigation, camera and all water stay fixed.
"""
import bpy,bmesh,json,math,sys
from pathlib import Path
from mathutils import Vector
from array import array
ROOT=Path(__file__).resolve().parents[3];WORK=ROOT/'output/guaira/path-finish-2026-10-15';DOC=ROOT/'docs/world/guaira/path-finish-2026-10-15'
WORK.mkdir(parents=True,exist_ok=True);DOC.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene;nav=json.loads(scene['native_navigation']);layout=json.loads((WORK/'path-layout.json').read_text());draft='--draft' in sys.argv
assert scene['native_map_revision']==5,'Author this pass from revision 5, never on its own output.'
col=bpy.data.collections['Guaíra | caminhos'];archive=bpy.data.collections.new('Paths v5 — preserved source');scene.collection.children.link(archive)
new=[];archived=[];footings=[]
def preserve(ob):
    if ob.hide_render:return
    archived.append(ob.name);ob.hide_render=True;ob.hide_viewport=True
    for c in list(ob.users_collection):c.objects.unlink(ob)
    archive.objects.link(ob);ob.name='Archived v5 - '+ob.name
def mesh(name,vs,fs,mat,bevel=0):
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();bm=bmesh.new();bm.from_mesh(me)
    assert all(e.is_manifold for e in bm.edges),name+': open edge'
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));volume=bm.calc_volume(signed=True)
    assert volume>1e-10 and all(f.calc_area()>1e-12 for f in bm.faces),name+': invalid solid'
    bm.to_mesh(me);bm.free();ob=bpy.data.objects.new('Path v6 '+name,me);col.objects.link(ob);me.materials.append(mat);ob['stage_id']='paths'
    if bevel:
        mod=ob.modifiers.new('Soft dressed edges','BEVEL');mod.width=bevel;mod.segments=2;ob.modifiers.new('Area weighted normals','WEIGHTED_NORMAL')
    new.append({'name':ob.name,'phase':'paths','volume':volume});return ob
def box(name,p,d,mat,bevel=.005):
    x,y,z=p;a,b,c=[v/2 for v in d];vs=[(x+sx*a,y+sy*b,z+sz*c) for sx,sy,sz in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
    return mesh(name,vs,[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)],mat,bevel)
def beam(name,a,b,width,mat,thickness=None):
    a,b=Vector(a),Vector(b);v=b-a;ob=box(name,(0,0,0),(width,thickness or width,v.length),mat,min(.005,width*.12));ob.location=(a+b)/2;ob.rotation_euler=v.to_track_quat('Z','Y').to_euler();return ob
def solid(name,s,low,high,mat):
    vs=[];ids={};fs=[]
    def vert(x,y,z):
        key=(round(x,6),round(y,6),z)
        if key not in ids:ids[key]=len(vs);vs.append(key)
        return ids[key]
    for tri in s['triangles']:fs.extend([tuple(vert(x,y,high) for x,y in tri),tuple(vert(x,y,low) for x,y in reversed(tri))])
    for r in [s['ring'],*s['holes']]:fs.extend((vert(*a,low),vert(*b,low),vert(*b,high),vert(*a,high)) for a,b in zip(r,r[1:]+r[:1]))
    return mesh(name,vs,fs,mat,.0025)
stone=bpy.data.materials['Guaira native honed limestone tread'];edge=bpy.data.materials['Guaira native worn sandstone edge']
wood=bpy.data.materials['Finish v5 seasoned joinery'];light=bpy.data.materials['Finish v5 cut timber edges'];iron=bpy.data.materials['Finish v5 recessed aged iron']
for ob in list(scene.objects):
    if ob.name.startswith(('Finish v5 paving edge','Native bridge fitted plank','Native bridge low','Paddy bridge founded abutment','Paddy bridge timber bearer')):preserve(ob)
for index,s in enumerate(layout['stones']):solid('fitted curb '+str(index),s,1.725,1.8645,edge)

# Four founded heads carry both the deck bearers and the guard posts. The
# transverse public-water channel stays open below the timber structure.
for x in (2.62,3.58):
    for y in (-2.12,-1.38):
        ob=box('bridge founded head',(x,y,1.745),(.30,.20,.11),stone,.009)
        footings.append({'name':ob.name,'x':x,'y':y,'bottom':1.69})
for x in (2.70,3.50):box('bridge continuous bearer',(x,-1.75,1.8225),(.10,1.0,.055),wood,.004)
for index in range(10):
    box('bridge fitted deck '+str(index),(3.10,-2.18+(index+.5)*.086,1.865),(1.06,.082,.050),light if index%4!=2 else wood,.003)
    # Recessed-looking small iron heads lie at the two actual bearer positions.
    for x in (2.70,3.50):box('bridge deck fastener',(x,-2.18+(index+.5)*.086,1.889),(.017,.017,.004),iron,.002)

# These gently sloped heads follow the existing authored height transitions.
for name,a,b in [('south',(-2.28,1.835),(-2.18,1.89)),('north',(-1.32,1.89),(-1.22,1.835))]:
    vs=[(x,y,z) for x in (2.59,3.61) for y,z in [(a[0],1.71),(b[0],1.71),(b[0],b[1]),(a[0],a[1])]]
    mesh('bridge '+name+' flush approach',vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],stone,.003)
for x in (2.555,3.645):
    for y in (-2.12,-1.38):
        box('bridge tenoned post',(x,y,1.997),(.077,.077,.404),wood,.006)
        box('bridge post cap',(x,y,2.202),(.091,.091,.030),light,.008)
        box('bridge post iron shoe',(x,y,1.831),(.084,.084,.070),iron,.003)
        for z in (1.963,2.112):box('bridge rail pin',(x+(-.044 if x<3.1 else .044),y,z),(.013,.024,.024),iron,.003)
    for z,width in ((1.964,.034),(2.112,.052)):
        beam('bridge fitted guardrail',(x,-2.156,z),(x,-1.344,z),width,light,.045)
    beam('bridge diagonal brace',(x,-2.08,1.981),(x,-1.42,2.09),.026,wood,.026)

bpy.context.view_layer.update();nav['revision']=6;nav['source']='docs/world/guaira/path-finish-2026-10-15/guaira-paths.blend'
w,h=(1280,800) if draft else (1920,1200);nav['depth'].update(width=w,height=h)
scene['native_map_revision']=6;scene['native_navigation']=json.dumps(nav,ensure_ascii=False)
scene['path_finish_notes']='Continuous dressed curb runs with 3 mm joints, founded bridge heads, continuous timber bearers, fitted guardrails and flush approaches.'
scene.render.resolution_x=w;scene.render.resolution_y=h;scene.render.resolution_percentage=100
scene.render.threads_mode='FIXED';scene.render.threads=4;scene.cycles.device='CPU';scene.cycles.samples=16 if draft else 64;scene.cycles.use_denoising=True;scene.view_layers[0].use_pass_z=True
group=bpy.data.node_groups.new('Path finish paired beauty depth','CompositorNodeTree');scene.compositing_node_group=group;group.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
layer=group.nodes.new('CompositorNodeRLayers');layer.scene=scene;out=group.nodes.new('NodeGroupOutput');group.links.new(layer.outputs['Image'],out.inputs['Image'])
file=group.nodes.new('CompositorNodeOutputFile');file.directory=str(WORK);file.file_name='depth-'+('draft-' if draft else 'final-');file.format.media_type='IMAGE';file.format.file_format='OPEN_EXR';file.format.color_depth='32';file.format.color_mode='RGB';file.save_as_render=False
file.file_output_items.new('RGBA','Depth');group.links.new(layer.outputs['Depth'],file.inputs[0])
scene.render.filepath=str(WORK/('guaira-draft.png' if draft else 'guaira.png'))
(WORK/('navigation-draft.json' if draft else 'navigation.json')).write_text(json.dumps(nav,indent=2,ensure_ascii=False)+'\n')
previous=json.loads((ROOT/'output/guaira/entrance-finish-2026-10-15/model-report.json').read_text())
(WORK/'model-report.json').write_text(json.dumps({'revision':6,'newClosedMeshes':new,'archivedSourceObjects':archived,
    'foundedBases':previous['foundedBases']+footings,'cavities':previous['cavities'],'curbStones':len(layout['stones']),'curbRuns':len(layout['runs']),'jointWidth':.003},indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'guaira-draft.blend' if draft else DOC/'guaira-paths.blend'))
print('GUAIRA_PATHS_AUTHORED',len(new),'closed meshes;',len(layout['stones']),'fitted curb stones',flush=True)
if '--no-render' not in sys.argv:
    bpy.ops.render.render(write_still=True);exr=max(WORK.glob(file.file_name+'Depth*.exr'),key=lambda p:p.stat().st_mtime)
    im=bpy.data.images.load(str(exr),check_existing=False);pixels=array('f',[0])*len(im.pixels);im.pixels.foreach_get(pixels);packed=array('H')
    for y in reversed(range(h)):
        for x in range(w):
            z=pixels[(y*w+x)*4];packed.append(min(65535,max(0,round(z*256))) if math.isfinite(z) else 65535)
    (WORK/('depth-draft.u16' if draft else 'depth.u16')).write_bytes(packed.tobytes());print('GUAIRA_PATHS_RENDERED',w,h,flush=True)
