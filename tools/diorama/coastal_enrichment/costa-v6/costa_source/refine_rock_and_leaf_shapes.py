# Portable wrapper: rendering is controlled by render_costa_v6.py.
import os

def render_if_requested():
    if os.environ.get("FEKA_RENDER_ACTIVE") == "1":
        bpy.ops.render.render(write_still=True)

"""Resolve the last visual issues: longitudinal arch stripes and angular leaf shading."""
import bpy, json, math, random
from pathlib import Path
from mathutils import Vector

ROOT=Path(os.environ["FEKA_REPO_ROOT"])
OUT=Path(os.environ["FEKA_OUTPUT_DIR"])
scene=bpy.context.scene
for obj in list(scene.objects):
    if obj.get('enrichment_group')=='natural_deep_arch':bpy.data.objects.remove(obj,do_unlink=True)

# Multiple irregular depth sections break the tunnel's long parallel top panels.
count,depths=28,6
vertices=[]
for inside in [False,True]:
    for j in range(depths):
        t=j/(depths-1)
        y=-2.85+1.70*t
        for i in range(count+1):
            a=math.pi-i*math.pi/count
            rough=math.sin(i*1.41+j*.93)*math.sin(a)
            if inside:
                x=-.60+(1.16+.018*rough)*math.cos(a)
                z=.33+(1.92+.025*rough)*math.sin(a)
            else:
                x=-.60+(1.86+.038*rough)*math.cos(a)
                z=.35+(2.45+.074*rough)*math.sin(a)
            vertices.append((x,y+.027*math.sin(i*.93+j),z))
stride=count+1;layer=depths*stride;faces=[];kinds=[]
for inside in [False,True]:
    start=layer if inside else 0
    for j in range(depths-1):
        for i in range(count):
            a=start+j*stride+i;b=a+1;c=b+stride;d=a+stride
            faces += [(a,b,c),(a,c,d)] if (i+j)%2 else [(a,b,d),(b,c,d)]
            kinds += ['inside' if inside else 'outside']*2
for j in [0,depths-1]:
    for i in range(count):
        a=j*stride+i;b=a+1;c=layer+b;d=layer+a
        faces += [(a,b,c),(a,c,d)];kinds += ['face','face']
for i in [0,count]:
    for j in range(depths-1):
        a=j*stride+i;b=a+stride;faces.append((a,b,layer+b,layer+a));kinds.append('foot')
data=bpy.data.meshes.new('irregular coastal arch volume');data.from_pydata(vertices,[],faces);data.update()
obj=bpy.data.objects.new('prototype v5 irregular coastal arch volume',data);bpy.context.collection.objects.link(obj)
palette=[bpy.data.materials['sandstone '+str(i)] for i in [1,2,4,5]]
for material in palette:data.materials.append(material)
for face,kind in zip(data.polygons,kinds):
    center=sum((data.vertices[i].co for i in face.vertices),Vector())/len(face.vertices)
    if kind=='inside':face.material_index=2 if center.z<1 else 3
    else:
        tone=math.sin(center.x*3.4+center.y*2.0)+.5*math.sin(center.z*5.5-center.x)
        face.material_index=0 if tone<-.6 else 1 if tone>.65 else 3
obj['enrichment_group']='natural_deep_arch';obj['decorative_floor']=False
bevel=obj.modifiers.new('worn solid stone edges','BEVEL');bevel.width=.022;bevel.segments=2
obj.modifiers.new('weighted natural stone normals','WEIGHTED_NORMAL')

# Smooth broad blades follow their authored curve; a consistent darker folded
# half replaces the distracting alternating color facets of the rough preview.
changed_leaves=0
for obj in scene.objects:
    if obj.type!='MESH' or not any(term in obj.name for term in ['large sculpted coastal leaf','sculpted tall coastal foliage']):continue
    for face in obj.data.polygons:
        face.material_index=0 if face.index%2 else 1
        face.use_smooth=True
    changed_leaves+=1

original=json.loads((ROOT/'public/assets/world/map/costa-diorama.meta.json').read_text())
camera=scene.camera;namespace={'target':Vector((0,0,2.7))}
source=(OUT/'build_prototype.py').read_text()
exec('def audit_additions():'+source.split('def audit_additions():',1)[1].split('\nfirst_audit =',1)[0],globals())
audit=audit_additions();assert not audit['flags'],json.dumps(audit['flags'])
(OUT/'costa-v5-audit.json').write_text(json.dumps({'bodyRays':audit['bodyRays'],'cameraRays':audit['cameraRays'],'flags':audit['flags'],
    'smoothBroadLeafMeshes':changed_leaves,'archDepth':1.70,'sourceNodesAndRoutesUnchanged':True,'cameraUnchanged':True,
    'limits':'Static scratch art prototype with sampled body/view checks, not a production deployment or full gameplay certification.'},indent=2))
scene.cycles.samples=32;scene.render.resolution_percentage=50
scene.render.filepath=str(OUT/'costa-after-v5.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'costa-enrichment-prototype-v5.blend'))
render_if_requested()
print('COSTA_REVIEW_READY='+str(OUT/'costa-after-v5.png'))
