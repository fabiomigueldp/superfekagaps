# Portable wrapper: rendering is controlled by render_costa_v6.py.
import os

def render_if_requested():
    if os.environ.get("FEKA_RENDER_ACTIVE") == "1":
        bpy.ops.render.render(write_still=True)

"""Costa v6 art refinement. Rebuild deterministically from the bundled v5 scene.
Usage: blender -b base-v5.blend -t 8 -P build_costa_v6.py -- [--final]
This script writes only to its own folder. Camera, route contract, node clearings,
walkway meshes and pier/sea departure corridor are preserved and locally audited.
"""
import bpy, math, random, json, hashlib, sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
P=Path(os.environ["FEKA_OUTPUT_DIR"])
random.seed(6110626)
scene=bpy.context.scene
META=json.loads((P/'base-costa.meta.json').read_text())
BASE={o.name:([list(r) for r in o.matrix_world],len(o.data.vertices) if o.type=='MESH' else None) for o in scene.objects}
CAMERA=[list(r) for r in scene.camera.matrix_world]
protected=[o for o in scene.objects if any(s in o.name for s in ['continuous supported treads','worn sandstone footpath','natural clearing ','secret branch beach landing','east stair open arrival landing','dock ','pile cut end','western gap bridge','lighthouse approach bridge'])]
protected_geometry={o.name: hashlib.sha256(str([(tuple(v.co)) for v in o.data.vertices]).encode()).hexdigest() for o in protected if o.type=='MESH'}

def srgb(c):return tuple(((v+.055)/1.055)**2.4 if v>.04045 else v/12.92 for v in c)
def mat(name,c,rough=.82,metal=0):
 m=bpy.data.materials.new('v6 '+name);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*srgb(c),1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m

def tag(o,name,group,floor=False):o.name='v6 '+name;o['enrichment_group']=group;o['decorative_floor']=floor;return o

def mesh(name,verts,faces,materials,group,floor=False):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('v6 '+name,me);scene.collection.objects.link(o)
 for m in materials:me.materials.append(m)
 return tag(o,name,group,floor)

def line(name,pts,r,material,group,floor=False):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=1;s=c.splines.new('POLY');s.points.add(len(pts)-1)
 for p,co in zip(s.points,pts):p.co=(*co,1)
 o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);o.data.materials.append(material);return tag(o,name,group,floor)

def cube(name,loc,dim,material,group,bevel=.02):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=dim;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 if bevel:
  b=o.modifiers.new('worn edges','BEVEL');b.width=bevel;b.segments=2;o.modifiers.new('weighted normals','WEIGHTED_NORMAL')
 return tag(o,name,group)

def beam(name,a,b,r,material,group):return line(name,[a,b],r,material,group)
def ico(name,loc,dim,material,group,sub=1):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=loc);o=bpy.context.object;o.scale=dim;o.data.materials.append(material);return tag(o,name,group)

def cyl(name,loc,r,h,material,group,n=12):
 bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=h,location=loc);o=bpy.context.object;o.data.materials.append(material);return tag(o,name,group)

# Continuous geological strata: same world-height phase across all cliff faces,
# uneven weathering, dark wet feet and pale resistant limestone. No block grid.
geology=mat('erosion layered warm sandstone',(.79,.59,.35))
n=geology.node_tree.nodes;l=geology.node_tree.links;p=n['Principled BSDF'];geo=n.new('ShaderNodeNewGeometry');sep=n.new('ShaderNodeSeparateXYZ');l.new(geo.outputs['Position'],sep.inputs[0])
noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=2.6;noise.inputs['Detail'].default_value=2;l.new(geo.outputs['Position'],noise.inputs['Vector'])
mult=n.new('ShaderNodeMath');mult.operation='MULTIPLY';mult.inputs[1].default_value=.40;l.new(noise.outputs['Fac'],mult.inputs[0])
add=n.new('ShaderNodeMath');add.operation='ADD';l.new(sep.outputs['Z'],add.inputs[0]);l.new(mult.outputs[0],add.inputs[1])
freq=n.new('ShaderNodeMath');freq.operation='MULTIPLY';freq.inputs[1].default_value=1.72;l.new(add.outputs[0],freq.inputs[0])
fract=n.new('ShaderNodeMath');fract.operation='FRACT';l.new(freq.outputs[0],fract.inputs[0])
ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.interpolation='LINEAR'
cols=[(0,(.62,.43,.28)),(.10,(.70,.49,.31)),(.21,(.81,.61,.39)),(.44,(.84,.64,.42)),(.74,(.78,.56,.34)),(.96,(.71,.49,.31))]
for e in list(ramp.color_ramp.elements)[1:]:ramp.color_ramp.elements.remove(e)
for i,(pos,col) in enumerate(cols):e=ramp.color_ramp.elements[0] if i==0 else ramp.color_ramp.elements.new(pos);e.position=pos;e.color=(*srgb(col),1)
l.new(fract.outputs[0],ramp.inputs[0])
wet=n.new('ShaderNodeMapRange');wet.inputs['From Min'].default_value=.28;wet.inputs['From Max'].default_value=.82;wet.inputs['To Min'].default_value=.68;wet.inputs['To Max'].default_value=0;l.new(sep.outputs['Z'],wet.inputs[0])
mix=n.new('ShaderNodeMixRGB');mix.blend_type='MIX';l.new(wet.outputs[0],mix.inputs[0]);l.new(ramp.outputs[0],mix.inputs[1]);mix.inputs[2].default_value=(*srgb((.34,.39,.35)),1);l.new(mix.outputs[0],p.inputs['Base Color'])
bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.13;bump.inputs['Distance'].default_value=.065;l.new(noise.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs[0],p.inputs['Normal'])

# Keep original top/base rings (and all supported walk meshes) exactly in place.
# Subdivide intermediate exposed sides into irregular horizontal erosional ledges.
geo_names=['western bridge headland','central green backbone','east lower climbing terrace','east lighthouse bastion','far west low outcrop','right sea stack']
route_samples=[]
for kind,routes in META['worldRoutes'].items():
 for route in routes:
  for a,b in zip(route['world'],route['world'][1:]):
   a,b=Vector(a),Vector(b);route_samples.extend(a.lerp(b,i/12) for i in range(13))
for k,name in enumerate(geo_names):
 o=bpy.data.objects[name];old=[v.co.copy() for v in o.data.vertices];count=len(old)//5;cx=sum(v.x for v in old)/len(old);cy=sum(v.y for v in old)/len(old)
 levels=[0,.08,.16,.235,.255,.37,.48,.515,.535,.65,.755,.775,.88,1];vs=[]
 for j,t in enumerate(levels):
  segment=min(3,int(t*4));local=t*4-segment
  for i in range(count):
   q=old[segment*count+i].lerp(old[(segment+1)*count+i],local);rad=Vector((q.x-cx,q.y-cy,0)).normalized()
   if 0<j<len(levels)-1:
    near=min((q-s).length for s in route_samples)
    amount=(.032*math.sin(i*1.83+j*.32)+.06*math.sin(j*2.77)+(.075 if j in [3,7,11] else -.018))
    if near<.75:amount=min(0,amount)*.3
    q+=rad*amount;q.z+=.022*math.sin(i*.81+j*.6)
   vs.append(tuple(q))
 fs=[]
 for j in range(len(levels)-1):
  for i in range(count):
   a=j*count+i;b=j*count+(i+1)%count;c=(j+1)*count+(i+1)%count;d=(j+1)*count+i
   fs.extend([(a,b,d),(b,c,d)] if (i+j)%3==0 else [(a,b,c,d)])
 fs += [tuple(range(count-1,-1,-1)),tuple((len(levels)-1)*count+i for i in range(count))]
 me=bpy.data.meshes.new(name+' eroded strata');me.from_pydata(vs,[],fs);me.update();me.materials.append(geology);o.data=me
 o['enrichment_group']='v6_structural_geology';o['decorative_floor']=False
 for mod in list(o.modifiers):o.modifiers.remove(mod)
 b=o.modifiers.new('subtle worn erosion edges','BEVEL');b.width=.012;b.segments=1;o.modifiers.new('weighted normals','WEIGHTED_NORMAL')
for o in scene.objects:
 if o.type=='MESH' and ('split sandstone buttress' in o.name or 'tide worn sandstone boulder' in o.name):o.data.materials.clear();o.data.materials.append(geology)

# Natural asymmetrical deep sea cave: triangulated front, irregular inside profile,
# resistant horizontal strata and exposed intrados in shadow, not voussoir blocks.
for o in list(scene.objects):
 if o.get('enrichment_group')=='natural_deep_arch':bpy.data.objects.remove(o,do_unlink=True)
N=32;R=5;D=7;vs=[]
for j in range(D):
 t=j/(D-1);y=-2.89+1.78*t
 for r in range(R):
  f=r/(R-1)
  for i in range(N+1):
   a=math.pi-i*math.pi/N;s=math.sin(a)
   ix=-.64+(1.14+.038*math.sin(i*1.7+j*.8)*s)*math.cos(a);iz=.32+(1.89+.095*math.sin(a*3+.45))*s
   ox=-.59+(1.88+.046*math.sin(i*.83+j*.52)*s)*math.cos(a);oz=.34+(2.51+.082*math.sin(a*4+.6))*s
   x=ix+(ox-ix)*f;z=iz+(oz-iz)*f
   # gentle rock shelves aligned with geology, never circular manufactured seams
   yf=y+.036*math.sin(i*.82+r*1.3+j*.55)+.045*math.sin(z*13+x*.7)
   vs.append((x,yf,z))
def idx(j,r,i):return j*R*(N+1)+r*(N+1)+i
fs=[]
for j in [0,D-1]:
 for r in range(R-1):
  for i in range(N):
   a,b,c,d=idx(j,r,i),idx(j,r,i+1),idx(j,r+1,i+1),idx(j,r+1,i)
   fs.extend([(a,b,c),(a,c,d)] if (i+r)%2 else [(a,b,d),(b,c,d)])
for r in [0,R-1]:
 for j in range(D-1):
  for i in range(N):
   a,b,c,d=idx(j,r,i),idx(j,r,i+1),idx(j+1,r,i+1),idx(j+1,r,i);fs.extend([(a,b,c),(a,c,d)])
for i in [0,N]:
 for j in range(D-1):
  for r in range(R-1):fs.append((idx(j,r,i),idx(j+1,r,i),idx(j+1,r+1,i),idx(j,r+1,i)))
arch=mesh('stratified eroded deep coastal arch',vs,fs,[geology],'v6_arch')
b=arch.modifiers.new('sand eroded edge','BEVEL');b.width=.018;b.segments=1;arch.modifiers.new('weighted cave normals','WEIGHTED_NORMAL')

# Non-spherical coastal foliage. Replace old ball-like shrubs and vine balls with
# irregular clusters of folded, pointed leaves in multiple olive/jade shades.
leaf_mats=[mat('foliage deep jade',(.10,.31,.19)),mat('foliage mid emerald',(.18,.43,.21)),mat('foliage sunlit lime',(.43,.62,.20)),mat('foliage sage underside',(.33,.51,.24)),mat('foliage gold new growth',(.57,.66,.22))]
root_m=mat('plant stem moss',(.19,.32,.12))
def leafblade(name,root,angle,L,W,H,group,mi=1,twist=0):
 root=Vector(root);dire=Vector((math.cos(angle),math.sin(angle),0));side=Vector((-dire.y,dire.x,0));vs=[]
 for i in range(7):
  t=i/6;center=root+dire*L*t+Vector((0,0,H*math.sin(t*math.pi*.77)))
  w=W*math.sin(t*math.pi)**.85*(1+.09*math.sin(i*2));fold=.028*math.sin(math.pi*t)
  vs += [tuple(center-side*w+Vector((0,0,-fold))),tuple(center+Vector((0,0,fold))),tuple(center+side*w+Vector((0,0,-fold+twist*t)))]
 fs=[]
 for i in range(6):fs += [(3*i,3*i+1,3*i+4,3*i+3),(3*i+1,3*i+2,3*i+5,3*i+4)]
 o=mesh(name,vs,fs,[leaf_mats[mi],leaf_mats[(mi+1)%4]],group)
 for f in o.data.polygons:f.material_index=f.index%2
 return o

def cluster(root,s,group,seed):
 rng=random.Random(seed)
 for tier,count in [(0,8),(1,6),(2,4)]:
  for i in range(count):
   a=i*math.tau/count+rng.uniform(-.3,.3);rr=.07*s
   base=Vector(root)+Vector((rr*math.cos(a),rr*math.sin(a),tier*.10*s))
   leafblade('layered pointed coastal leaf',base,a,s*rng.uniform(.39,.62)*(1-.15*tier),s*rng.uniform(.10,.15),s*(.25+.19*tier),group,rng.choice([0,1,1,2,3]))

old_shrubs=[o for o in list(scene.objects) if o.type=='MESH' and any(s in o.name for s in ['rounded coastal shrub','soft grouped coastal leaves','fuller broadleaf understorey'])]
# Consolidate three adjacent spheres into one broad foliage mass, not a sprig each.
centers=[]
for o in old_shrubs:
 pos=o.matrix_world.translation.copy();s=max(o.scale)*1.6
 if min(((pos-p).length for p,_ in centers),default=100)>.34:centers.append((pos,s))
 bpy.data.objects.remove(o,do_unlink=True)
for i,(p,s) in enumerate(centers):cluster((p.x,p.y,p.z-.09),max(.48,min(.95,s*1.6)),'v6_understorey_'+str(i),600+i)
# Rooted cliff curtains: flat heart-like pointed foliage, alternating leaf fans.
for vi,o in enumerate(list(scene.objects)):
 if o.type=='MESH' and any(s in o.name for s in ['trailing coastal leaf','trailing heart leaf']):
  p=o.matrix_world.translation.copy();i=len(centers);a=(-1 if i%2 else 1)*.4
  leafblade('cliff trailing broad leaf',p,random.uniform(-2.8,-.5),.22,.085,-.16,'v6_cliff_curtain_'+str(vi),random.choice([0,1,2,3]));bpy.data.objects.remove(o,do_unlink=True)
# Large fern/banana silhouettes grouped away from the walkway.
for i,(root,s) in enumerate([((-5.63,-.65,3.02),.9),((-4.12,1.85,3.07),1.0),((5.31,-.73,2.84),1.05),((.28,2.52,2.99),.86),((2.9,3.60,4.76),.55)]):
 for j in range(7):leafblade('broad coastal fan',root,j*2.399,.86*s,.24*s,(.64+.10*(j%3))*s,'v6_fan_'+str(i),j%4)

# Sparse rooted vegetation follows the arch's actual sloping rock crown.
# This is not a new route; each little moss island and leaf fan is clearance-tested.
bpy.context.view_layer.update()
arch_bvh=BVHTree.FromPolygons([v.co for v in arch.data.vertices],[tuple(f.vertices) for f in arch.data.polygons])
for k,(ax,ay,radius) in enumerate([(-1.25,-1.85,.31),(-.25,-2.0,.38),(.32,-1.66,.22)]):
 points=[]
 for j in range(13):
  a=j*math.tau/12;x=ax+radius*math.cos(a)*(1+.16*math.sin(j*2.3));y=ay+radius*.68*math.sin(a)
  hit,_,_,_=arch_bvh.ray_cast(Vector((x,y,5)),Vector((0,0,-1)),6)
  if hit:points.append((hit.x,hit.y,hit.z+.02))
 if len(points)>6:
  mesh('arch crown rooted moss island',points,[tuple(range(len(points)))],[leaf_mats[3]],'v6_fan_arch_'+str(k))
  hit,_,_,_=arch_bvh.ray_cast(Vector((ax,ay,5)),Vector((0,0,-1)),6)
  for j in range(6):leafblade('arch crown low fern',tuple(hit+Vector((0,0,.025))),j*2.399,.37,.07,.19,'v6_fan_arch_'+str(k),j%4)

# Rebuild west fishing corner with a taller, wider sagging linen sail canopy.
for o in list(scene.objects):
 if o.get('enrichment_group')=='west_fishing_hamlet':bpy.data.objects.remove(o,do_unlink=True)
wood=mat('old boatyard timber',(.41,.26,.14));timber=mat('sunwashed decking',(.64,.43,.22));rope=mat('salt worn hemp',(.75,.65,.43));linen=mat('cream fishing sail',(.95,.88,.67));linen_shade=mat('warm canvas seams',(.78,.66,.40));teal=mat('painted sea turquoise',(.10,.47,.46));coral=mat('boat coral paint',(.75,.21,.12));ivory=mat('boat ivory stripe',(.95,.88,.66));metal=mat('boatyard dark metal',(.13,.20,.19),.52,.3)
g='v6_fishing_shelter';cx,cy=-7.61,-2.54
for i in range(10):cube('shelter deck slat',(cx-.94+i*.21,cy,.40),(.19,1.52,.10),timber if i%3 else wood,g,.01)
for dy in [-.54,.54]:cube('shelter transverse deck bearer',(cx,cy+dy,.29),(1.92,.12,.15),wood,g,.012)
for dx in [-.88,.88]:
 for dy in [-.67,.67]:
  beam('shelter rooted pile',(cx+dx,cy+dy,-.24),(cx+dx,cy+dy,.49),.075,wood,g)
  beam('canopy mast',(cx+dx,cy+dy,.43),(cx+dx,cy+dy,1.87+(.24 if dy>.0 else 0)),.037,wood,g)
# 8x5 fabric grid makes visible billow and dipped central hem, rather than a box.
vs=[];nx,ny=8,5
for j in range(ny):
 v=j/(ny-1)
 for i in range(nx):
  u=i/(nx-1);vs.append((cx-1.02+2.04*u,cy-.79+1.58*v,1.85+.25*v-.20*math.sin(math.pi*u)*math.sin(math.pi*(.15+.7*v))+.035*math.sin(u*math.pi*4)*math.sin(math.pi*v)))
fs=[]
for j in range(ny-1):
 for i in range(nx-1):a=j*nx+i;fs.append((a,a+1,a+nx+1,a+nx))
o=mesh('billowing cream sail awning',vs,fs,[linen],g);sol=o.modifiers.new('canvas thickness','SOLIDIFY');sol.thickness=.016
for j in [0,ny-1]:line('sail sewn hem',[vs[j*nx+i] for i in range(nx)],.017,linen_shade,g)
for i in [0,nx-1]:line('canvas side rope',[vs[j*nx+i] for j in range(ny)],.014,rope,g)
for dx in [-.88,.88]:line('cross bracing rope',[(cx+dx,cy-.67,.59),(cx+dx,cy+.67,1.92)],.012,rope,g)
# Net curtain deliberately visible against the shadow of the rear workshop.
for i in range(10):
 x=cx-.78+i*.145;line('hanging diamond net warp',[(x,cy+.61,1.45),(x+.14,cy+.57,1.14),(x,cy+.54,.82),(x+.09,cy+.53,.50)],.0065,rope,g)
for j in range(6):line('hanging net weft',[(cx-.78+i*.145,cy+.56,.53+j*.17-.065*math.sin(i*.55)) for i in range(10)],.0065,rope,g)
# Workbench, a pair of weathered crates and glazed fishing floats.
cube('fisher work bench',(cx-.24,cy+.13,.88),(1.21,.45,.10),timber,g)
for dx in [-.71,.22]:beam('bench leg',(cx+dx,cy+.13,.46),(cx+dx,cy+.13,.87),.035,wood,g)
for dx,dy,s in [(.51,-.31,.36),(-.73,-.35,.28)]:
 cube('open catch crate',(cx+dx,cy+dy,.44+s/2),(s,s*.84,s),wood,g)
 for k in range(3):cube('crate sunlit slat',(cx+dx,cy+dy-s*.44,.48+k*s*.31),(s+.018,.025,.055),timber,g,.006)
for i in range(4):ico('colorful glass fishing float',(cx-.58+i*.22,cy-.0,1.0),(.07,.07,.08),teal if i%2 else coral,g,2)
# Baskets with readable rope-ribbed sides.
for bx,by in [(cx+.59,cy+.27),(cx-.75,cy-.48)]:
 cyl('woven fish basket',(bx,by,.58),.15,.28,timber,g,16)
 for z in [.49,.57,.65,.72]:line('basket horizontal weave',[(bx+.158*math.cos(a*math.tau/20),by+.158*math.sin(a*math.tau/20),z) for a in range(21)],.01,rope,g)
 for i in range(12):a=i*math.tau/12;line('basket vertical weave',[(bx+.156*math.cos(a),by+.156*math.sin(a),.44),(bx+.163*math.cos(a),by+.163*math.sin(a),.73)],.007,rope,g)
# Sandy shore boardwalk reaches the existing beach without modifying any route.
for i in range(9):cube('fishers shore approach slat',(-6.66+i*.15,cy+.14,.395),(.14,.58,.07),timber,g,.01)

for dy in [-.20,.20]:cube('shore boardwalk grounded runner',(-6.06,cy+.14+dy,.341),(1.41,.07,.06),wood,g,.007)

# Small grounded fishing dinghy on the exposed SW beach, outside every route.
g='v6_beached_dinghy';bx,by=-4.95,-3.93;angle=-.15;L=1.55;W=.59
vs=[];segments=18
for z,f in [(.34,.63),(.48,.92),(.74,1)]:
 for i in range(segments):
  a=i*math.tau/segments;x=math.cos(a)*L/2*f;y=math.sin(a)*W/2*f
  vs.append((bx+x*math.cos(angle)-y*math.sin(angle),by+x*math.sin(angle)+y*math.cos(angle),z+.07*abs(math.cos(a))))
fs=[]
for j in range(2):
 for i in range(segments):fs.append((j*segments+i,j*segments+(i+1)%segments,(j+1)*segments+(i+1)%segments,(j+1)*segments+i))
o=mesh('red fishing dinghy hull',vs,fs,[coral,ivory],g)
for f in o.data.polygons:f.material_index=0 if f.index<segments else 1
mesh('dinghy dark inside floor',vs[:segments],[tuple(range(segments))],[teal],g)
line('dinghy turquoise gunwale',vs[2*segments:]+[vs[2*segments]],.028,teal,g)
for dx in [-.33,.28]:
 o=cube('dinghy bench',(bx+dx*math.cos(angle),by+dx*math.sin(angle),.64),(.14,.49,.05),timber,g,.012);o.rotation_euler.z=angle
beam('dinghy wooden oar',(bx-.7,by-.23,.75),(bx+.72,by+.13,.75),.022,timber,g)
o=cube('dinghy oar blade',(bx+.64,by+.12,.75),(.27,.10,.024),timber,g,.018);o.rotation_euler.z=.22
line('dinghy mooring rope',[(bx-.7,by-.10,.69),(bx-.95,by+.22,.36),(bx-1.05,by+.38,.38)],.014,rope,g)

# Organic aquamarine shallows, with submerged teal stones and broken foam lace.
# All patches exclude x>3.1/y<-1.9, preserving the exact ferry departure sector.
for o in list(scene.objects):
 if o.get('enrichment_group')=='shoreline_organic':bpy.data.objects.remove(o,do_unlink=True)
def watermat(name,col,opacity):
 m=bpy.data.materials.new('v6 '+name);m.use_nodes=True;n=m.node_tree.nodes;l=m.node_tree.links;n.clear();out=n.new('ShaderNodeOutputMaterial');mix=n.new('ShaderNodeMixShader');mix.inputs[0].default_value=opacity;tr=n.new('ShaderNodeBsdfTransparent');em=n.new('ShaderNodeEmission');em.inputs[0].default_value=(*srgb(col),1);em.inputs[1].default_value=1;l.new(tr.outputs[0],mix.inputs[1]);l.new(em.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],out.inputs[0]);return m
wat=[watermat('shallow aquamarine',(.18,.76,.70),.58),watermat('shallow jade fade',(.21,.70,.68),.32),watermat('shallow outer fade',(.18,.63,.65),.13)]
foam=watermat('broken ivory sea foam',(.86,.95,.88),.65);foamdim=watermat('dissolving sea foam',(.69,.87,.81),.32)
wetstone=mat('wet coastal gray stone',(.30,.38,.36));stonehi=mat('sun dried gray sandstone',(.55,.56,.45))
# Freeform footprint from actual expanded beach rim, independent faceted bays.
beach=bpy.data.objects['single sculpted sand shoreline'];rim=[v.co.copy() for v in beach.data.vertices[1:65]];center=Vector((-.1,-.38,0))
# Shared feathered rings, not individual hard-edged colored tiles.
fade=bpy.data.materials.new('v6 feathered transparent cove');fade.use_nodes=True
nn=fade.node_tree.nodes;ll=fade.node_tree.links;nn.clear();out=nn.new('ShaderNodeOutputMaterial');mix=nn.new('ShaderNodeMixShader');tr=nn.new('ShaderNodeBsdfTransparent');em=nn.new('ShaderNodeEmission');em.inputs[0].default_value=(*srgb((.23,.76,.72)),1);attr=nn.new('ShaderNodeVertexColor');attr.layer_name='WaterFade';ll.new(attr.outputs['Alpha'],mix.inputs[0]);ll.new(tr.outputs[0],mix.inputs[1]);ll.new(em.outputs[0],mix.inputs[2]);ll.new(mix.outputs[0],out.inputs[0])
ringvals=[(1.001,.19),(1.035,.42),(1.12,.24),(1.24,0.0)];waterverts=[];alphas=[];active=[]
for i,p in enumerate(rim):
 w=.94+.12*math.sin(i*.52)+.055*math.sin(i*1.4);f=1+.24*w;x=center.x+(p.x-center.x)*f;y=center.y+(p.y-center.y)*f
 active.append(not (x>3.1 and y<-1.9))
for factor,opacity in ringvals:
 for i,p in enumerate(rim):
  w=.94+.12*math.sin(i*.52)+.055*math.sin(i*1.4);f=1+(factor-1)*w
  waterverts.append((center.x+(p.x-center.x)*f,center.y+(p.y-center.y)*f,.019))
  distance=min([min(abs(i-k),64-abs(i-k)) for k,a in enumerate(active) if not a],default=10)
  alphas.append(opacity*min(1,distance/2))
waterfaces=[]
for r in range(3):
 for i in range(64):
  k=(i+1)%64
  if active[i] and active[k]:waterfaces.append((r*64+i,r*64+k,(r+1)*64+k,(r+1)*64+i))
wo=mesh('feathered organic shallow shelf',waterverts,waterfaces,[fade],'v6_shallows',True)
attr=wo.data.color_attributes.new(name='WaterFade',type='FLOAT_COLOR',domain='CORNER')
for poly in wo.data.polygons:
 for loop in poly.loop_indices:attr.data[loop].color=(1,1,1,alphas[wo.data.loops[loop].vertex_index])
for i,p in enumerate(rim):
 q=rim[(i+1)%len(rim)]
 if not active[i] or not active[(i+1)%64]:continue
 # Curls and separated arcs avoid a hard solid perimeter.
 if i%7 in [0,1,3]:
  pts=[]
  for j in range(9):
   t=j/8;r=p.lerp(q,t);f=1.022+.014*math.sin(t*math.pi)+.005*math.sin(i)
   pts.append((center.x+(r.x-center.x)*f,center.y+(r.y-center.y)*f,.040))
  line('broken lapping shore wave',pts,.011 if i%3 else .017,foam,'v6_shallows',True)
 if i%11==2:
  pts=[]
  for j in range(8):
   t=j/7;r=p.lerp(q,t);f=1.17+.015*math.sin(t*math.pi)
   pts.append((center.x+(r.x-center.x)*f,center.y+(r.y-center.y)*f,.034))
  line('outer dissolving wave',pts,.007,foamdim,'v6_shallows',True)
# Grey jagged low rocks give the beach a more natural tidal edge, as in the concept.
for i,(x,y,s) in enumerate([(-7.3,-3.12,.38),(-6.1,-4.05,.36),(-3.72,-4.65,.40),(-1.93,-4.98,.30),(.66,-4.77,.36),(6.98,.30,.31),(7.12,1.68,.27)]):
 g='v6_tidal_cluster_'+str(i)
 for j in range(4):
  xx=x+.30*s*math.cos(j*2.4);yy=y+.75*s*math.sin(j*2.4);ss=s*(1-.18*j)
  o=ico('angular tide rock',(xx,yy,.025+ss*.28),(ss,ss*.77,ss*.67),stonehi if j==0 else wetstone,g,1);o.rotation_euler.z=j*.8
 for f in [1.25,1.5]:
  line('tidal stone foam curl',[(x+s*f*math.cos(a),y+s*f*.73*math.sin(a),.047) for a in [math.pi*.65+j*math.pi*1.15/14 for j in range(15)]],.010 if f<1.3 else .007,foam if f<1.3 else foamdim,g,True)

# Audits are run before delivering a render. Remove only unsafe new foliage groups;
# structural, water, shelter and boat changes must pass rather than be hidden.
bpy.context.view_layer.update()
def audit():
 dg=bpy.context.evaluated_depsgraph_get();camdir=(scene.camera.location-Vector((0,0,2.7))).normalized();flags=[];rays=views=0
 for kind,routes in META['worldRoutes'].items():
  for route in routes:
   for a,b in zip(route['world'],route['world'][1:]):
    a,b=Vector(a),Vector(b);d=b-a;side=Vector((-d.y,d.x,0)).normalized();steps=max(3,math.ceil(d.length/.14))
    for j in range(steps):
     point=a.lerp(b,j/steps)
     for off in [-.12,0,.12] if kind=='secret' else [-.23,0,.23]:
      rays+=1;h,loc,_,_,ob,_=scene.ray_cast(dg,point+side*off+Vector((0,0,1.15)),Vector((0,0,-1)),distance=1.6)
      if h and str(ob.get('enrichment_group','')).startswith('v6_') and not ob.get('decorative_floor') and loc.z>point.z+.18:flags.append({'type':'body','group':ob.get('enrichment_group'),'object':ob.name,'point':list(point)})
     for height in [.2,.65,1.0]:
      views+=1;actor=point+Vector((0,0,height));h,_,_,_,ob,_=scene.ray_cast(dg,actor+camdir*35,-camdir,distance=34.99)
      if h and str(ob.get('enrichment_group','')).startswith('v6_') and not ob.get('decorative_floor'):flags.append({'type':'view','group':ob.get('enrichment_group'),'object':ob.name,'point':list(point)})
 return {'bodyRays':rays,'cameraRays':views,'flags':flags}
first=audit();final=first;removable=[]
while final['flags']:
 unsafe=sorted(set(f['group'] for f in final['flags']))
 remove=[g for g in unsafe if g.startswith(('v6_understorey_','v6_fan_','v6_cliff_curtain_'))]
 if not remove:break
 removable.extend(remove)
 for o in list(scene.objects):
  if o.get('enrichment_group') in remove:bpy.data.objects.remove(o,do_unlink=True)
 bpy.context.view_layer.update();final=audit()
for name,sig in protected_geometry.items():assert hashlib.sha256(str([(tuple(v.co)) for v in bpy.data.objects[name].data.vertices]).encode()).hexdigest()==sig,name+' changed'
assert CAMERA==[list(r) for r in scene.camera.matrix_world]
report={'variant':'Costa v6 substantial visual polish','baseFile':'base-v5.blend','cameraUnchanged':True,'nodesAndRoutesUnchanged':True,'protectedWalkMeshes':len(protected_geometry),'walkMeshesIdentical':True,'removedUnsafeFoliageGroups':removable,'initialAudit':first,'finalAudit':final,'limits':'Static art prototype. Sampled route body/view checks and identity checks, not a full gameplay certification.'}
(P/'costa-v6-audit.json').write_text(json.dumps(report,indent=2))
assert not final['flags'], 'Unresolved route obstruction; see costa-v6-audit.json'
# Render only after the sampled route-clearance and identity checks pass.
scene.cycles.samples=64 if '--final' in sys.argv else 24;scene.cycles.use_denoising=False;scene.render.resolution_percentage=100 if '--final' in sys.argv else 50
scene.render.filepath=str(P/('costa-v6-final.png' if '--final' in sys.argv else 'costa-v6-preview.png'))
bpy.ops.wm.save_as_mainfile(filepath=str(P/'costa-v6.blend'));render_if_requested()
print('V6_RENDER='+scene.render.filepath);print('AUDIT_FLAGS='+str(len(final['flags'])))
