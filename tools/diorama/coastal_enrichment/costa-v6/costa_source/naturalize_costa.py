# Portable wrapper: rendering is controlled by render_costa_v6.py.
import os

def render_if_requested():
    if os.environ.get("FEKA_RENDER_ACTIVE") == "1":
        bpy.ops.render.render(write_still=True)

"""Natural geology and fuller foliage for the stronger Costa prototype."""
import bpy, json, math, random
from pathlib import Path
from mathutils import Vector

OUT=Path(os.environ["FEKA_OUTPUT_DIR"])
ROOT=Path(os.environ["FEKA_REPO_ROOT"])
scene=bpy.context.scene
random.seed(7772)
names=['western bridge headland','central green backbone','east lower climbing terrace','east lighthouse bastion','far west low outcrop','right sea stack']
with bpy.data.libraries.load(str(OUT/'costa-enrichment-prototype.blend'),link=False) as (available, loaded):
    loaded.meshes=list(names)
for name,data in zip(names,loaded.meshes):
    obj=bpy.data.objects[name]
    obj.data.materials.clear()
    for material in data.materials:obj.data.materials.append(material)
    for target,source in zip(obj.data.polygons,data.polygons):target.material_index=source.material_index

# Enlarge free exterior sand only. All original boundary points remain enclosed;
# the departure corner and its exact dock/sea corridor are excluded.
beach=bpy.data.objects['single sculpted sand shoreline']
def expansion(angle):
    return .105*math.exp(-((angle+2.52)/.49)**2)+.065*math.exp(-((angle+1.71)/.31)**2)+.035*math.exp(-((angle-.28)/.38)**2)
for vertex in beach.data.vertices:
    point=vertex.co
    if math.hypot(point.x+.1,point.y+.38)<1:continue
    if point.x>3.1 and point.y< -1.9:continue
    angle=math.atan2((point.y+.38)/4.29,(point.x+.1)/7.05)
    grow=1+expansion(angle)
    point.x=-.1+(point.x+.1)*grow;point.y=-.38+(point.y+.38)*grow
beach['enrichment_group']='expanded_sand_cov es'.replace(' ','');beach['decorative_floor']=True

# One irregular solid arch surface, with facets instead of identical masonry seams.
for obj in list(scene.objects):
    if obj.get('enrichment_group')=='deep_arch':bpy.data.objects.remove(obj,do_unlink=True)
palette=[bpy.data.materials['sandstone '+str(i)] for i in range(6)]
count,cx=24,-.60
outer,inner=[],[]
for i in range(count+1):
    angle=math.pi-i*math.pi/count
    outer.append((cx+(1.86+.018*math.sin(i*1.6))*math.cos(angle),.35+(2.47+.050*math.sin(i*1.32))*math.sin(angle)))
    inner.append((cx+(1.16+.022*math.sin(i*1.7))*math.cos(angle),.33+(1.92+.028*math.cos(i*1.1))*math.sin(angle)))
vertices=[]
for ring,y in [(outer,-2.86),(inner,-2.84),(outer,-1.15),(inner,-1.15)]:
    vertices.extend((x,y+.035*math.sin(i*1.93),z) for i,(x,z) in enumerate(ring))
n=count+1;faces=[]
for i in range(count):
    a,b,c,d=i,i+1,n+i+1,n+i
    center=(Vector(vertices[a])+Vector(vertices[b])+Vector(vertices[c])+Vector(vertices[d]))/4
    center.y-=.035+.035*math.sin(i*2.1)
    mid=len(vertices);vertices.append(tuple(center))
    faces += [(a,b,mid),(b,c,mid),(c,d,mid),(d,a,mid),
              (2*n+i,3*n+i,3*n+i+1,2*n+i+1),(i,2*n+i,2*n+i+1,i+1),(n+i,n+i+1,3*n+i+1,3*n+i)]
faces += [(0,n,3*n,2*n),(n-1,2*n-1,4*n-1,3*n-1)]
mesh=bpy.data.meshes.new('natural deep sea arch');mesh.from_pydata(vertices,[],faces);mesh.update()
obj=bpy.data.objects.new('prototype v4 natural deep sea arch',mesh);bpy.context.collection.objects.link(obj)
for material in palette:mesh.materials.append(material)
for face in mesh.polygons:face.material_index=random.choice([1,2,2,3,3,4,5])
obj['enrichment_group']='natural_deep_arch';obj['decorative_floor']=False
bevel=obj.modifiers.new('weather softened continuous vault','BEVEL');bevel.width=.035;bevel.segments=2
obj.modifiers.new('weighted cliff normals','WEIGHTED_NORMAL')

# Reuse sculpted leaf helpers without rebuilding earlier scenery.
bold=(OUT/'build_bolder_costa.py').read_text()
exec(bold[bold.index('def tag('):bold.index('original_metadata =')],globals())
leaf_dark=bpy.data.materials['v3 shaded broad foliage'];leaf_mid=bpy.data.materials['v3 broadleaf spring green'];leaf_light=bpy.data.materials['v3 young foliage green']
def curve(name,points,thickness,material,floor=False):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.bevel_depth=thickness;data.bevel_resolution=2
    spline=data.splines.new('POLY');spline.points.add(len(points)-1)
    for p,co in zip(spline.points,points):p.co=(*co,1)
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.data.materials.append(material);return obj
exec('def frond(' + bold.split('def frond(',1)[1].split('\nplant_groups =',1)[0],globals())
for group,root,angles,scale in [
    ('west_rear_lush_cluster',(-4.18,1.58,3.075),[.2,.9,1.8,2.5],1.20),
    ('east_broadleaf_cluster',(5.25,-.40,2.825),[-.1,.6,1.25],1.32),
]:
    for i,angle in enumerate(angles):frond('sculpted tall coastal foliage',root,angle,scale*(1+.09*i),.25*scale,.87*scale,group)
    for i in range(7):
        a=i*2.4;point=Vector(root)+Vector((.28*math.cos(a),.24*math.sin(a),.20+.09*(i%2)))
        stone('fuller broadleaf understorey',point,(.29,.24,.24),[leaf_mid,leaf_dark,leaf_light][i%3],group)

# Move soft cove patches and curved wash to the expanded shoreline. They remain
# separate zero-alpha fades, without a complete colored island outline.
for obj in list(scene.objects):
    if obj.get('enrichment_group')!='shoreline_organic':continue
    if obj.type=='MESH':
        for vertex in obj.data.vertices:
            p=vertex.co;angle=math.atan2((p.y+.38)/4.29,(p.x+.1)/7.05);grow=1+expansion(angle)
            p.x=-.1+(p.x+.1)*grow;p.y=-.38+(p.y+.38)*grow
    elif obj.type=='CURVE':
        for spline in obj.data.splines:
            for vertex in spline.points:
                p=vertex.co;angle=math.atan2((p.y+.38)/4.29,(p.x+.1)/7.05);grow=1+expansion(angle)
                p.x=-.1+(p.x+.1)*grow;p.y=-.38+(p.y+.38)*grow

original=json.loads((ROOT/'public/assets/world/map/costa-diorama.meta.json').read_text())
camera=scene.camera;namespace={'target':Vector((0,0,2.7))}
source=(OUT/'build_prototype.py').read_text()
exec('def audit_additions():'+source.split('def audit_additions():',1)[1].split('\nfirst_audit =',1)[0],globals())
first=audit_additions();unsafe=sorted({flag['group'] for flag in first['flags']})
assert not any(group not in ['west_rear_lush_cluster','east_broadleaf_cluster'] for group in unsafe),json.dumps(first['flags'])
for obj in list(scene.objects):
    if obj.get('enrichment_group') in unsafe:bpy.data.objects.remove(obj,do_unlink=True)
final=audit_additions() if unsafe else first
assert not final['flags']
(OUT/'costa-v4-audit.json').write_text(json.dumps({'fiveIDsPreserved':list(original['nodes']),'routesChanged':False,'cameraUnchanged':True,'dockCorridorUnchanged':True,
    'shoreExpansion':'Free west/southwest coves up to10.5%, east berth sector excluded. Original sand footprint remains enclosed.',
    'arch':'Continuous faceted natural vault,1.7worldunits deep; no regular block seam or boolean operations.',
    'removedUnsafeGroups':unsafe,'finalAudit':final,'limits':'Scratch prototype, sampled body/camera checks and visual inspection; not live gameplay QA.'},indent=2))
scene.cycles.samples=24;scene.render.resolution_percentage=50;scene.render.filepath=str(OUT/'costa-after-v4.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'costa-enrichment-prototype-v4.blend'))
render_if_requested()
print('COSTA_V4_READY='+str(OUT/'costa-after-v4.png'))
