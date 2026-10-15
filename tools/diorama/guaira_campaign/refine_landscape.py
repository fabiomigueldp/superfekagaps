"""Guaíra revision 3: eroded coast, fitted civic masonry and founded cistern.

Source: docs/world/guaira/terrain-polish-2026-10-15/guaira-terrain.blend.
1. Run --export-inputs, then layout_landscape.py in system Python.
2. Reopen the source and run --draft for review or no flags for final assets.
The rendered camera, terrain top, native routes and water surfaces stay fixed.
"""
import bpy, bmesh, json, math, sys
from pathlib import Path
from collections import Counter
from array import array
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[3]
WORK = ROOT / 'output/guaira/landscape-finish-2026-10-15'
DOC = ROOT / 'docs/world/guaira/landscape-finish-2026-10-15'
WORK.mkdir(parents=True, exist_ok=True); DOC.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
nav = json.loads(scene['native_navigation'])
bpy.context.view_layer.update()
if '--export-inputs' in sys.argv:
    civic = bpy.data.objects['Civic terrace']
    outline = [list((civic.matrix_world @ v.co)[:2]) for v in civic.data.vertices
               if abs((civic.matrix_world @ v.co).z - 2.4) < .0001]
    terrain = bpy.data.objects['Continuous clay island']
    indices = sorted({i for p in terrain.data.polygons if len(p.vertices)==3 for i in p.vertices})
    water = {o.name: [list(o.matrix_world@v.co) for v in o.data.vertices]
             for o in scene.objects if not o.hide_render and o.type=='MESH'
             and any(m and m.name=='Clean turquoise water' for m in o.data.materials)}
    (WORK / 'landscape-input.json').write_text(json.dumps({'civicOutline': outline, 'navigation': nav,
        'terrainTop': [[i,list(terrain.data.vertices[i].co)] for i in indices], 'waterMeshes':water}) + '\n')
    print('LANDSCAPE_INPUT_EXPORTED', flush=True)
    sys.exit(0)

draft = '--draft' in sys.argv
layout = json.loads((WORK / 'landscape-layout.json').read_text())
collection = bpy.data.collections.new('Guaíra landscape finish v3')
scene.collection.children.link(collection)
archive = bpy.data.collections.new('Landscape v2 - preserved source')
scene.collection.children.link(archive)
new, archived = [], []

def preserve(ob):
    archived.append(ob.name)
    ob.hide_render = True; ob.hide_viewport = True
    for col in list(ob.users_collection): col.objects.unlink(ob)
    archive.objects.link(ob)
    ob.name = 'Archived v2 - ' + ob.name

def mesh(name, vertices, faces, materials, bevel=0):
    me = bpy.data.meshes.new(name); me.from_pydata(vertices, [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me)
    assert all(e.is_manifold for e in bm.edges), name + ': open edge'
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    volume = bm.calc_volume(signed=True)
    assert volume > 1e-10 and all(f.calc_area() > 1e-12 for f in bm.faces), name + ': invalid solid'
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('Landscape v3 ' + name, me); collection.objects.link(ob)
    for mat in materials: me.materials.append(mat)
    if bevel:
        mod = ob.modifiers.new('Worn fitted arris', 'BEVEL'); mod.width = bevel; mod.segments = 2
        ob.modifiers.new('Area weighted normals', 'WEIGHTED_NORMAL')
    new.append({'name': ob.name, 'vertices': len(vertices), 'faces': len(faces), 'volume': volume})
    return ob

def linear(color):
    return tuple((v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4)
                 for v in [int(color[i:i+2], 16) / 255 for i in (0, 2, 4)])

def material(name, color, roughness=.85):
    m = bpy.data.materials.new('Landscape v3 ' + name); m.use_nodes = True
    rgb = linear(color); m.diffuse_color = (*rgb, 1)
    p = m.node_tree.nodes['Principled BSDF']; p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Roughness'].default_value = roughness; p.inputs['Specular IOR Level'].default_value = .23
    return m

def box(name, center, size, mat, bevel=.008):
    x,y,z=center; a,b,c=[v/2 for v in size]
    vertices=[(x+sx*a,y+sy*b,z+sz*c) for sx,sy,sz in
              [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
    return mesh(name,vertices,[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)],[mat],bevel)

def timber(name, a, b, width, mat):
    a,b=Vector(a),Vector(b); delta=b-a
    ob=box(name,(0,0,0),(width,width,delta.length),mat,.005)
    ob.location=(a+b)/2; ob.rotation_euler=delta.to_track_quat('Z','Y').to_euler()
    return ob

# Re-carve only the coast below the existing top: shared vertices remain
# watertight, with identical walking, airport and building support elevations.
terrain=bpy.data.objects['Continuous clay island']
original=terrain.copy();original.data=terrain.data.copy();scene.collection.objects.link(original)
original.name='Continuous clay island revision 2';preserve(original)
surface=[p for p in terrain.data.polygons if len(p.vertices)==3]
counts=Counter(tuple(sorted((f.vertices[i], f.vertices[(i+1)%3]))) for f in surface for i in range(3))
boundary={}
for f in surface:
    for a,b in zip(f.vertices, list(f.vertices[1:])+[f.vertices[0]]):
        if counts[tuple(sorted((a,b)))]==1: boundary[a]=b
ring=[min(boundary)]
while boundary[ring[-1]]!=ring[0]: ring.append(boundary[ring[-1]])
assert len(ring)==len(boundary)
# Recover ordered rings from the mesh itself, rather than an ignored build file.
quads=[list(p.vertices) for p in terrain.data.polygons if len(p.vertices)==4]
assert len(quads)==len(ring)*8
edges={}
for face in quads:
    for a,b in zip(face,face[1:]+face[:1]):
        edges.setdefault(a,set()).add(b);edges.setdefault(b,set()).add(a)
visited=set(v for p in surface for v in p.vertices);previous=ring
coast_rings=[]
for layer in range(8):
    current=[]
    for a in previous:
        candidates=edges[a]-visited
        assert len(candidates)==1, ('Ambiguous shared coast ring',layer,a,candidates)
        current.append(next(iter(candidates)))
    coast_rings.append(current);visited.update(current);previous=current
for k,index in enumerate(ring):
    x,y,top=terrain.data.vertices[index].co
    radial=Vector((x+.4,y-.05));radial.normalize()
    long=.12*math.sin(.61*x+.23*y)+.055*math.sin(.91*y-.29*x)
    fold=.085*math.sin(.92*x-.54*y+.5)
    erosion=sum(.26*math.exp(-((x-cx)/rx)**2-((y-cy)/ry)**2)
                for cx,cy,rx,ry in [(-4.1,-3.55,.60,.72),(-1.65,-4.35,.72,.60),
                                    (1.55,-4.82,.84,.52),(4.92,-4.68,.66,.70),(6.93,-1.50,.60,.90)])
    swell=.075*math.sin(1.13*x+.34*y)+.045*math.cos(.72*y-.41*x)
    seam=.025+.065*(.5+.5*math.sin(.77*x+.62*y))**3
    levels=[(.035,top-.10-.026*math.sin(x+y)),
            (.13+swell-erosion*.5,1.43+long),
            (.17+swell-erosion,1.08+long+fold),
            (.17+swell-erosion-seam,1.015+long+fold),
            (.15+swell*.7-erosion*.7,.82+long*.65-fold*.30),
            (-.015+swell*.8-erosion*.5,.41+long*.42+fold*.2),
            (-.24+swell*.4-erosion*.2,.17+long*.13),
            (-.40+swell*.3,.065)]
    assert all(a[1]>b[1] for a,b in zip(levels,levels[1:])), 'Crossed stratum'
    for layer,(offset,z) in enumerate(levels):
        terrain.data.vertices[coast_rings[layer][k]].co=(x+radial.x*offset,y+radial.y*offset,z)
terrain.data.update();terrain['terrain_revision']=3
scene['landscape_coast_rings']=json.dumps(coast_rings)
# Subdue the continuous dark stripe; the carved depth and varying exposure
# now carry the geology. A large-scale ramp varies its iron staining smoothly.
seam_mat=terrain.data.materials[2].copy();seam_mat.name='Landscape v3 discontinuous iron seam'
ns=seam_mat.node_tree.nodes;ls=seam_mat.node_tree.links;p=ns['Principled BSDF']
geom=ns.new('ShaderNodeNewGeometry');noise=ns.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=.67;noise.inputs['Detail'].default_value=1
ls.new(geom.outputs['Position'],noise.inputs['Vector']);ramp=ns.new('ShaderNodeValToRGB')
for element,pos,color in zip(ramp.color_ramp.elements,(.32,.70),('B37249','AC6C44')):
    element.position=pos;element.color=(*linear(color),1)
ls.new(noise.outputs['Fac'],ramp.inputs['Fac']);ls.new(ramp.outputs['Color'],p.inputs['Base Color'])
terrain.data.materials[2]=seam_mat
terrain.data.calc_loop_triangles()
ground_tree=BVHTree.FromPolygons([terrain.matrix_world@v.co for v in terrain.data.vertices],
                               [tuple(t.vertices) for t in terrain.data.loop_triangles],all_triangles=True)
def ground(x,y):
    hit,_,_,_=ground_tree.ray_cast(Vector((x,y,4)),Vector((0,0,-1)),5)
    assert hit is not None, ('No ground',x,y)
    return hit.z

# Fitted civic retaining masonry: full corners, staggered joints, consistent
# mortar and a coping which terminates against the real staircase cheeks.
for ob in list(scene.objects):
    if not ob.hide_render and ob.name.startswith(('Civic fitted retaining stone','Native fitted civic coping')):preserve(ob)
stone=[bpy.data.materials[n] for n in ['Civic retaining warm sandstone','Civic retaining sun sandstone','Civic retaining iron sandstone']]
cap=bpy.data.materials['Guaira native honed limestone tread']
mortar=material('warm recessed mortar','9B876B')
for i,part in enumerate(layout['pieces']):
    vertices=[];ids={};faces=[]
    def vertex(x,y,z):
        key=(round(x,7),round(y,7),z)
        if key not in ids:ids[key]=len(vertices);vertices.append(key)
        return ids[key]
    low,high=part['bottom'],part['top']
    for tri in part['triangles']:
        faces.append(tuple(vertex(x,y,high) for x,y in tri));faces.append(tuple(vertex(x,y,low) for x,y in reversed(tri)))
    for outline in [part['ring'],*part['holes']]:
        for a,b in zip(outline,outline[1:]+outline[:1]):faces.append((vertex(*a,low),vertex(*b,low),vertex(*b,high),vertex(*a,high)))
    mesh(part['name'],vertices,faces,[mortar if part['kind']=='mortar' else cap if part['kind']=='cap' else stone[i%3]],part['bevel'])

# A built cistern replaces the nine-sided orange boulder below the reservoir.
# Its battered masonry follows the bowl; all courses and the apron are solid.
preserve(bpy.data.objects['Reservoir support'])
cistern_stones=[material('cistern sandstone '+str(i),color) for i,color in enumerate(['AAA58A','B3AD91','A39D83','B8B094'])]
cistern_mortar=material('cistern recessed joints','898B75')
soil=bpy.data.materials['Terrain v2 soil'];wood=bpy.data.materials['Dry timber'];darkwood=bpy.data.materials['Gate wood']
def radial_solid(name,rings,mat,bevel=0):
    n=len(rings[0]);vertices=[p for ring in rings for p in ring]
    faces=[tuple(range(n-1,-1,-1)),tuple(range((len(rings)-1)*n,len(rings)*n))]
    faces += [(row*n+i,row*n+(i+1)%n,(row+1)*n+(i+1)%n,(row+1)*n+i) for row in range(len(rings)-1) for i in range(n)]
    return mesh(name,vertices,faces,[mat],bevel)
def round_ring(radius,z,n=64):
    return [(4.5+radius*math.cos(k*math.tau/n),3.2+radius*math.sin(k*math.tau/n),z) for k in range(n)]
core=radial_solid('cistern structural core',[round_ring(1.107,1.70),round_ring(1.045,2.55)],cistern_mortar)
# An irregular low earth skirt joins the founded wall to the dry plateau.
apron=[]
for layer in range(3):
    row=[]
    for k in range(64):
        a=k*math.tau/64;r=(1.43+.09*math.sin(3*a+.3)+.05*math.sin(7*a)) if layer<2 else 1.09
        x,y=4.5+math.cos(a)*r,3.2+math.sin(a)*r
        z=ground(x,y)-.055 if layer==0 else ground(x,y)+.006 if layer==1 else 1.89
        row.append((x,y,z))
    apron.append(row)
apron_ob=radial_solid('cistern earth apron',apron,soil)
for p in apron_ob.data.polygons:p.use_smooth=True
for row in range(3):
    low=1.79+row*.252;high=low+.240
    r0=1.145-row*.024;r1=r0-.024
    count=18;offset=(.5 if row%2 else 0)*math.tau/count
    for k in range(count):
        a0=k*math.tau/count+offset+.004;a1=(k+1)*math.tau/count+offset-.004
        vertices=[]
        for z,outer in [(low,r0),(high,r1)]:
            for radius in (outer-.18,outer):
                vertices += [(4.5+radius*math.cos(a0+(a1-a0)*j/3),3.2+radius*math.sin(a0+(a1-a0)*j/3),z) for j in range(4)]
        faces=[(0,1,2,3,7,6,5,4),(8,12,13,14,15,11,10,9),(0,4,12,8),(3,11,15,7)]
        faces += [(j,j+8,j+9,j+1) for j in range(3)] + [(4+j,5+j,13+j,12+j) for j in range(3)]
        mesh(f'cistern radial course {row}-{k}',vertices,faces,[cistern_stones[(row*5+k)%4]],.008)

# Cut the actual falling-water throat through the core and the facing. Its
# sloping floor sits below the unchanged water plane (z = y + .31).
cutter_vertices=[(x,y,z) for y in (1.50,2.43)
                 for x,z in [(4.272,y+.274),(4.728,y+.274),(4.728,3.40),(4.272,3.40)]]
cutter=mesh('temporary throat cutter',cutter_vertices,
            [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],[cistern_mortar])
targets=[core]+[o for o in collection.objects if o.name.startswith('Landscape v3 cistern radial course')]
for ob in targets:
    # The exact solid subtraction only affects the few stones at the outlet.
    if ob!=core and min(v.co.y for v in ob.data.vertices)>2.43:continue
    if ob!=core and (max(v.co.x for v in ob.data.vertices)<4.272 or min(v.co.x for v in ob.data.vertices)>4.728):continue
    mod=ob.modifiers.new('Fitted water throat','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
    bpy.context.view_layer.objects.active=ob
    # Execute the cut before the small wear bevel, retaining a closed core.
    while ob.modifiers.find(mod.name)>0:bpy.ops.object.modifier_move_up(modifier=mod.name)
    bpy.ops.object.modifier_apply(modifier=mod.name)
new[:]=[r for r in new if r['name']!=cutter.name]
bpy.data.objects.remove(cutter,do_unlink=True)

# The descent channel receives an actual founded bed and closed side cheeks.
# Its visible water quad and the irrigation patch coordinates do not move.
channel=bpy.data.objects['Gravity supply clean flowing water']
water_vertices=[channel.matrix_world@v.co for v in channel.data.vertices]
for ob in list(scene.objects):
    if not ob.hide_render and ob.name.startswith('Gravity supply retaining lip'):preserve(ob)
def channel_wedge(name,x0,x1,raise_top,mat):
    vertices=[(x,y,z) for y,top in [(1.53,1.84),(2.37,2.68)] for x,z in [(x0,1.69),(x1,1.69),(x1,top+raise_top),(x0,top+raise_top)]]
    return mesh(name,vertices,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],[mat],.008)
channel_wedge('founded channel bed',4.26,4.74,-.027,bpy.data.materials['Canal bed'])
for side,x0,x1 in [('west',4.235,4.305),('east',4.695,4.765)]:
    channel_wedge('channel retaining cheek '+side,x0,x1,.037,cistern_stones[1])

# Reservoir maintenance access is re-founded after changing the embankment.
# Stone shoes touch the new land; stair and deck supports meet those shoes.
bpy.context.view_layer.update()
support_objects=[terrain,apron_ob]
verts=[];faces=[]
for ob in support_objects:
    ob.data.calc_loop_triangles();base=len(verts);verts.extend(ob.matrix_world@v.co for v in ob.data.vertices)
    faces.extend(tuple(base+i for i in t.vertices) for t in ob.data.loop_triangles)
support_tree=BVHTree.FromPolygons(verts,faces,all_triangles=True)
contacts=[]
def footing(x,y):
    heights=[]
    for dx in (-.07,0,.07):
        for dy in (-.07,0,.07):
            p,_,_,_=support_tree.ray_cast(Vector((x+dx,y+dy,4)),Vector((0,0,-1)),5);assert p is not None;heights.append(p.z)
    low=min(heights)-.025;top=max(heights)+.065
    box('service stone shoe',(x,y,(low+top)/2),(.16,.17,top-low),cistern_stones[0],.009)
    contacts.append({'x':x,'y':y,'bottom':low,'supportMin':min(heights),'supportMax':max(heights),'top':top})
    return top
for ob in list(scene.objects):
    if not ob.hide_render and ob.name.startswith('Reservoir grounded deck post'):preserve(ob)
for x in (5.69,6.01):
    for y in (2.51,3.04):
        z=footing(x,y);timber('seated reservoir deck post',(x,y,z-.014),(x,y,2.55),.074,darkwood)
    footing(x,1.69)
# A continuous outside handrail gives the narrow maintenance stair a clear edge.
for y,z in [(1.70,1.84),(2.12,2.34)]:
    timber('service stair rail post',(6.04,y,z-.06),(6.04,y,z+.43),.042,darkwood)
timber('service stair handrail',(6.04,1.66,2.225),(6.04,2.50,2.970),.048,wood)

# Two agaves belonged to the top of the old orange boulder. Their old root
# heights put the leaves through the new stone courses. Replant on dry land,
# with a closed, folded leaf volume instead of the former two open triangles.
replanted=[]
for old_x,old_y,x,y in [(5.41,2.55,5.97,3.75),(4.0,4.03,3.10,4.10)]:
    group=[]
    for ob in list(scene.objects):
        if ob.hide_render or ob.type!='MESH' or not ob.name.startswith('Dry agave blade'):continue
        root=ob.matrix_world@((ob.data.vertices[0].co+ob.data.vertices[1].co)/2)
        if abs(root.x-old_x)<.001 and abs(root.y-old_y)<.001:group.append(ob)
    assert group, ('Missing original bank agave',old_x,old_y)
    mat=group[0].data.materials[0]
    for ob in group:preserve(ob)
    root_z=ground(x,y)-.013
    for k in range(7):
        a=k*math.tau/7+.17;dx,dy=math.cos(a),math.sin(a)
        length=.22+.025*math.sin(k*1.7);h=.135+.025*math.cos(k*1.4);width=.031
        vertices=[(x-dy*width,y+dx*width,root_z),(x+dy*width,y-dx*width,root_z),
                  (x+dx*length,y+dy*length,root_z+h),
                  (x,y,root_z-.027),(x+dx*length*.46,y+dy*length*.46,root_z+h*.60-.025)]
        mesh(f'rooted bank agave {len(replanted)}-{k}',vertices,
             [(0,1,2),(0,3,1),(0,2,4),(2,1,4),(1,3,4),(3,0,4)],[mat])
    replanted.append({'from':[old_x,old_y,2.4],'to':[x,y,root_z],'archivedLeaves':len(group)})

bpy.context.view_layer.update()
# Preserve visible water surfaces byte-for-byte; the shader/depth pass remains
# based on the actual mesh rather than a painted replacement image.
assert all((a-b).length<1e-8 for a,b in zip(water_vertices,[channel.matrix_world@v.co for v in channel.data.vertices]))
nav['revision']=3;nav['source']='docs/world/guaira/landscape-finish-2026-10-15/guaira-landscape.blend'
w,h=(1280,800) if draft else (1920,1200)
nav['depth']['width']=w;nav['depth']['height']=h
scene['native_map_revision']=3;scene['native_navigation']=json.dumps(nav)
scene['landscape_revision_notes']='Eroded closed coast; fitted civic retaining corners and stair opening; founded radial cistern; supported channel and service access.'
scene.render.resolution_x=w;scene.render.resolution_y=h;scene.render.resolution_percentage=100
scene.render.threads_mode='FIXED';scene.render.threads=4;scene.cycles.device='CPU'
scene.cycles.samples=16 if draft else 64;scene.cycles.use_denoising=True;scene.view_layers[0].use_pass_z=True
group=bpy.data.node_groups.new('Landscape v3 paired beauty depth','CompositorNodeTree');scene.compositing_node_group=group
group.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
layer=group.nodes.new('CompositorNodeRLayers');layer.scene=scene
out=group.nodes.new('NodeGroupOutput');group.links.new(layer.outputs['Image'],out.inputs['Image'])
file=group.nodes.new('CompositorNodeOutputFile');file.directory=str(WORK);file.file_name='depth-'+('draft-' if draft else 'final-')
file.format.media_type='IMAGE';file.format.file_format='OPEN_EXR';file.format.color_depth='32';file.format.color_mode='RGB';file.save_as_render=False
file.file_output_items.new('RGBA','Depth');group.links.new(layer.outputs['Depth'],file.inputs[0])
scene.render.filepath=str(WORK/('guaira-draft.png' if draft else 'guaira.png'))
(WORK/('navigation-draft.json' if draft else 'navigation.json')).write_text(json.dumps(nav,indent=2)+'\n')
(WORK/'model-report.json').write_text(json.dumps({'revision':3,'newClosedMeshes':new,'archivedSourceObjects':archived,
    'coastBoundaryVertices':len(ring),'coastLayers':len(coast_rings),'terrainTopUnchanged':True,
    'serviceFootings':contacts,'replantedBankAgaves':replanted,'waterSurfaceUnchanged':True},indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'guaira-draft.blend' if draft else DOC/'guaira-landscape.blend'))
print('GUAIRA_LANDSCAPE_AUTHORED',len(new),'closed meshes',len(archived),'superseded objects',flush=True)
if '--no-render' not in sys.argv:
    bpy.ops.render.render(write_still=True)
    exr=max(WORK.glob(file.file_name+'Depth*.exr'),key=lambda p:p.stat().st_mtime)
    im=bpy.data.images.load(str(exr),check_existing=False);pixels=array('f',[0])*len(im.pixels);im.pixels.foreach_get(pixels);packed=array('H')
    for y in reversed(range(h)):
        for x in range(w):
            z=pixels[(y*w+x)*4];packed.append(min(65535,max(0,round(z*256))) if math.isfinite(z) else 65535)
    (WORK/('depth-draft.u16' if draft else 'depth.u16')).write_bytes(packed.tobytes())
    print('GUAIRA_LANDSCAPE_RENDERED',w,h,flush=True)
