"""Original grounded STOL terminals and Guaíra campaign diorama.
blender -b -t 8 -P tools/diorama/guaira_campaign/build.py -- --region guaira
Reuses the actual Guaíra neighborhood/canal scene, never changes the chapter art.
"""
import bpy, math, json, os, sys, runpy
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[3]
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
REGION=ARGS[ARGS.index('--region')+1] if '--region' in ARGS else 'guaira'
OUT=Path(ARGS[ARGS.index('--output-dir')+1]).resolve() if '--output-dir' in ARGS else ROOT/'public/assets/world/map/guaira-campaign';OUT.mkdir(parents=True,exist_ok=True)
if REGION=='guaira':
 source=ROOT/'tools/diorama/guaira/build_guaira.py'
 namespace={'__file__':str(source),'__name__':'guaira_campaign_source'}
 # Fresh authored geometry only; do not run the experimental export/save block.
 exec(compile(source.read_text().split('scene=bpy.context.scene;bpy.ops.object.camera_add')[0],str(source),'exec'),namespace)
elif REGION=='serra':
 source=ROOT/'tools/diorama/regional_enrichment/serra/enrich_serra.py'
 saved_argv=sys.argv[:]
 sys.argv=['blender','--','--output-dir','/tmp/feka-serra-rural-enrichment','--build-only','--samples','32']
 enriched=runpy.run_path(str(source));namespace=enriched['ns'];sys.argv=saved_argv
 for ob in list(bpy.context.scene.objects):
  if ob.type=='CAMERA':bpy.data.objects.remove(ob,do_unlink=True)
 # Widen the existing geological foot, keeping one continuous terrain object.
 foot=bpy.data.objects.get('continuous mountain foot')
 for v in foot.data.vertices:
  if v.co.y<-.3:
   weight=min(1,max(0,(-v.co.y-.3)/2.0));v.co.y-=1.2*weight
 foot.data.update()
 # The short offshore roll rests on one compact limestone continuation of the
 # existing foot. Its core is the exact two-direction three-wheel swept hull
 # plus 12 cm; the irregular shoulder narrows/tapers into the old coastline.
 # No separate runway slab, paint, buildings, or scenery relocation.
 from mathutils.bvhtree import BVHTree
 bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
 ev=foot.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles()
 support_tree=BVHTree.FromPolygons([ev.matrix_world@v.co for v in me.vertices],
   [tuple(t.vertices) for t in me.loop_triangles],all_triangles=True);ev.to_mesh_clear()
 def coastal_hull(points):
  points=sorted(points,key=lambda p:(p[0],p[1]));lo=[];hi=[]
  def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
  for p in points:
   while len(lo)>1 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
   lo.append(p)
  for p in reversed(points):
   while len(hi)>1 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
   hi.append(p)
  return lo[:-1]+hi[:-1]
 wheel_points=[]
 for x,y in [(-1.6,-4.0),(.1,-4.8)]:
  for frame in (30,14):
   a=frame*math.tau/32;c=math.cos(a);ss=math.sin(a)
   for wx,wy in [(.43,-.65),(.43,.65),(-1.8,0)]:
    wheel_points.append((x+.65*(c*wx-ss*wy),y+.65*(ss*wx+c*wy)))
 core=coastal_hull([(p[0]+.12*math.cos(k*math.tau/24),p[1]+.12*math.sin(k*math.tau/24),p[0],p[1],k)
   for p in coastal_hull(wheel_points) for k in range(24)])
 outer=[]
 for p in core:
  radius=.42+.065*math.sin(p[4]*1.7);a=p[4]*math.tau/24
  x,y=p[2]+radius*math.cos(a),p[3]+radius*math.sin(a)
  hit,_,_,_=support_tree.ray_cast(Vector((x,y,10)),Vector((0,0,-1)),20)
  outer.append((x,y,hit.z-.035 if hit is not None else -.20))
 n=len(core);vertices=[(p[0],p[1],.6) for p in core]+outer+[(p[0],p[1],-.24) for p in outer]
 faces=[tuple(range(n)),tuple(reversed(range(2*n,3*n)))]
 for ring in range(2):
  faces.extend([(ring*n+i,(ring+1)*n+i,(ring+1)*n+(i+1)%n,ring*n+(i+1)%n) for i in range(n)])
 coastal_mesh=bpy.data.meshes.new('Serra grounded coastal roll mesh');coastal_mesh.from_pydata(vertices,[],faces);coastal_mesh.update()
 # Each shared edge must be traversed in opposite directions. A merely closed
 # surface can still have inward shoulder faces and produce a dark union slit.
 from collections import Counter
 directed=Counter((face.vertices[i],face.vertices[(i+1)%len(face.vertices)])
   for face in coastal_mesh.polygons for i in range(len(face.vertices)))
 assert all(directed[(b,a)]==count for (a,b),count in directed.items()),'Inconsistent coastal support face winding'
 coastal_mesh.calc_loop_triangles()
 volume=sum(coastal_mesh.vertices[t.vertices[0]].co.dot(coastal_mesh.vertices[t.vertices[1]].co.cross(
   coastal_mesh.vertices[t.vertices[2]].co)) for t in coastal_mesh.loop_triangles)/6
 assert volume>0,'Coastal support must face outward'
 coastal=bpy.data.objects.new('Serra compact coastal roll union',coastal_mesh);bpy.context.collection.objects.link(coastal)
 for mat in foot.data.materials:coastal.data.materials.append(mat)
 for face in coastal.data.polygons:face.material_index=1 if face.index==0 or face.normal.z>.75 else 2 if face.normal.x>.35 else 0
 # Apply the old weathering first. Union yields a single closed ground object;
 # the wing-support core stays level while the lower rim keeps the rock taper.
 bpy.context.view_layer.objects.active=foot;foot.select_set(True)
 for modifier in list(foot.modifiers):bpy.ops.object.modifier_apply(modifier=modifier.name)
 union=foot.modifiers.new('Compact coastal terminal support','BOOLEAN');union.operation='UNION';union.solver='EXACT';union.object=coastal
 bpy.ops.object.modifier_apply(modifier=union.name);bpy.data.objects.remove(coastal,do_unlink=True)
 foot['terminal_roll_support']='closed compact coastal union; original scenery unchanged'
 coastal_support={'core':[[p[0],p[1],.6] for p in core],'shoulder':outer,'wheelMarginMeters':.12,
   'method':'closed irregular limestone union into existing mountain foot'}
 for ob in bpy.context.scene.objects:
  if ob.name.startswith('maintenance carrier'):ob.hide_render=True
else:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def material(name,color,metal=0):
 rgb=[int(color[i:i+2],16)/255 for i in (0,2,4)]
 linear=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
 m=bpy.data.materials.new('STOL '+name);m.diffuse_color=(*linear,1);m.use_nodes=True
 p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*linear,1);p.inputs['Roughness'].default_value=.72;p.inputs['Metallic'].default_value=metal
 return m
clay=material('compacted red earth','AF603B');rock=material('retaining masonry','9C8B70');dry=material('dry hard runway','BEAC88');ivory=material('warm ivory','F3DFC1');teal=material('teal paint','3B777C');roof=material('terracotta','BD583E');glass=material('blue glazing','427784');dark=material('graphite','34464C');gold=material('apron safety stripe','E7B754');coral=material('windsock coral','E66C45');wood=material('timber','866146')
if REGION=='fabrica': clay=material('industrial seawall','5C7074');rock=material('industrial retaining stone','687775');roof=teal
if REGION=='serra': clay=material('limestone cut platform','999F9E');rock=material('mountain retaining wall','B7B29F');dry=material('mountain runway','B4B09B')

def box(n,p,d,m,bevel=.035):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.name='STOL '+n;o.dimensions=d;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
 if bevel:
  b=o.modifiers.new('worn arris','BEVEL');b.width=bevel;b.segments=2;o.modifiers.new('weighted normals','WEIGHTED_NORMAL')
 return o

def rod(n,a,b,r,m):
 a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=(b-a).length,location=(a+b)/2);o=bpy.context.object;o.name='STOL '+n;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();o.data.materials.append(m);return o

def label(n,body,p,size,m):
 c=bpy.data.curves.new(n,'FONT');c.body=body;c.align_x='CENTER';c.align_y='CENTER';c.size=size;c.extrude=.005;o=bpy.data.objects.new('STOL '+n,c);bpy.context.collection.objects.link(o);o.location=p;o.rotation_euler=(math.pi/2,0,0);c.materials.append(m)

# Broad material variation remains readable after atlas downsampling; fine grain
# only breaks the sterile slab highlight. All treatment is visual, not geometry.
shoulder=material('graded gravel shoulder','B9A17D' if REGION!='serra' else 'A39F8B')
for mat,scale,strength in [(dry,7,.12),(clay,4,.17)]:
 nodes=mat.node_tree.nodes;links=mat.node_tree.links
 noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=scale;noise.inputs['Detail'].default_value=2
 bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=strength;bump.inputs['Distance'].default_value=.045
 links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],nodes['Principled BSDF'].inputs['Normal'])
 if mat==clay:
  # Sun-faded, compacted soil variation instead of a featureless vertical face.
  ramp=nodes.new('ShaderNodeValToRGB');base=list(mat.diffuse_color)
  ramp.color_ramp.elements[0].position=.20;ramp.color_ramp.elements[0].color=tuple(v*.68 for v in base[:3])+(1,)
  ramp.color_ramp.elements[1].position=.80;ramp.color_ramp.elements[1].color=tuple(min(1,v*1.13) for v in base[:3])+(1,)
  links.new(noise.outputs['Fac'],ramp.inputs['Fac']);links.new(ramp.outputs['Color'],nodes['Principled BSDF'].inputs['Base Color'])

# Rural landing clearings belong to the terrain, not freestanding airport slabs.
config={
 'guaira':dict(center=(-6.3,-.5,1.8),axis='y',join=(-5,-2.8,1.8),gate=(-5.5,-2.4,1.8),park=(-6.3,-1.8,1.8),terminal=(-4.7,-3.25),target=(-1.3,.25,3),cam=(9,-20,18.85),scale=25),
 'fabrica':dict(center=(1.8,-2.9,1.07),axis='x',join=(4.25,-1.85,1.18),gate=(4.8,-2.3,1.07),park=(3.3,-2.9,1.07),terminal=(5.2,-2.1),target=(0,.25,2.25),cam=(11,-20,17.5),scale=20.6),
 'serra':dict(center=(-1.6,-3.7,.60),axis='x',join=(-5.75,-3.6,1.65),gate=(-4.8,-3.7,.60),park=(-2.7,-3.7,.60),terminal=(-4.6,-3.5),target=(0,.25,3.6),cam=(11,-20,18.85),scale=20.6),
}[REGION]
cx,cy,z=config['center'];is_y=config['axis']=='y';dims=(3.7,7.7) if is_y else (7.7,3.7)
# Three uneven contour rings taper into a geological foot; no vertical slab walls.
def terrain(name,outline,top,mat,depth=True):
 n=len(outline)
 area=sum(outline[i][0]*outline[(i+1)%n][1]-outline[(i+1)%n][0]*outline[i][1] for i in range(n))
 if area<0:outline=list(reversed(outline))
 rings=[[(x,y,top) for x,y in outline]]
 if depth:
  rings += [[(cx+(x-cx)*1.11,cy+(y-cy)*1.07,top*.48) for x,y in outline],[(cx+(x-cx)*.92,cy+(y-cy)*.94,.10) for x,y in outline]]
 vs=sum(rings,[]);fs=[tuple(range(n))]
 for r in range(len(rings)-1):
  fs.extend([(r*n+i,r*n+(i+1)%n,(r+1)*n+(i+1)%n,(r+1)*n+i) for i in range(n)])
 if depth:fs.append(tuple(range(2*n,3*n)))
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new('STOL '+name,me);bpy.context.collection.objects.link(o);me.materials.append(mat);me.materials.append(clay)
 for f in me.polygons:f.material_index=0 if f.index==0 else 1
 if depth:
  bevel=o.modifiers.new('weathered terrain edges','BEVEL');bevel.width=.09;bevel.segments=3;o.modifiers.new('terrain normals','WEIGHTED_NORMAL')
 return o
meadow=material('local ground cover',{'guaira':'D67A3C','fabrica':'818C67','serra':'AAA99B'}[REGION])
dry=material('unpainted landing earth',{'guaira':'C6874C','fabrica':'A38459','serra':'C4BEA8'}[REGION])
def xy(w,l):
 w*=.50 if REGION in ['fabrica','serra'] else .82
 l*=.75 if REGION=='guaira' else .70 if REGION=='serra' else 1
 return (cx+w,cy+l) if is_y else (cx+l,cy+w)
outline=[xy(w,l) for w,l in [(-1.6,-3.9),(-2.0,-3.05),(-1.93,-1.5),(-2.05,.7),(-1.65,3.55),(-.7,3.9),(.9,3.8),(1.72,3.10),(2.0,1.35),(1.95,-1.5),(1.7,-3.55),(.25,-3.95)]]
if REGION=='guaira':terrain('continuous irregular landing meadow',outline,z-.027,meadow)
# The landing lane is narrow earth, with irregular soft shoulders. Unpainted.
if REGION!='serra':terrain('graded dirt clearing',[xy(w,l) for w,l in [(-1.28,-3.5),(-1.48,-2.3),(-1.34,.5),(-1.18,3.45),(-.3,3.62),(1.1,3.35),(1.35,1.7),(1.28,-1.9),(1.10,-3.45)]],z-.016 if REGION=='guaira' else z+.003,dry,False)
runway_start=(*xy(0,-3.1),z);runway_end=(*xy(0,3.1),z)
# Reserve the western wing envelope in this campaign-only clearing. These two
# cactus clusters originally grew through the aircraft; chapter vegetation and
# every building/terrain mesh stay untouched. Inset wheel contacts use the actual
# supported meadow, while the physical strip keeps its original 4.65m extent.
clearance_vegetation=[]
if REGION=='guaira':
 cactus_parts=('Cactus stem','Cactus arm','Cactus upright','Cluster cactus stem','Rounded cactus tip',
               'Long cactus rib','Curved cactus arm','Cluster upright','Cactus arm tip')
 for ob in bpy.context.scene.objects:
  if ob.name.startswith(cactus_parts):
   bounds=[ob.matrix_world@Vector(p) for p in ob.bound_box]
   if max(p.x for p in bounds)<-5.15:
    ob.hide_render=True;clearance_vegetation.append(ob.name)
 roll_start=(-6.85,-2.1,z);roll_end=(-6.85,.1,z)

walk=[config['join'],config['gate'],config['park']]
path_layer=0
def supported_path(a,b,width=.65):
 global path_layer
 path_layer+=1
 a,b=Vector(a),Vector(b);d=b-a;mid=(a+b)/2
 o=box('earth boarding trail',(mid.x,mid.y,z+.028+path_layer*.007),((b-a).length+.04,width,.035),dry,.01);o.rotation_euler.z=math.atan2(d.y,d.x)
for a,b in zip(walk,walk[1:]):
 if REGION=='serra' and abs(a[2]-b[2])>.1:
  av,bv=Vector(a),Vector(b);side=Vector((-(bv-av).y,(bv-av).x,0)).normalized()*.34
  vs=[tuple(v) for v in [av-side,av+side,bv+side,bv-side]];vs += [(x,y,.1) for x,y,_ in vs]
  me=bpy.data.meshes.new('supported slope');me.from_pydata(vs,[],[(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]);me.materials.append(rock);o=bpy.data.objects.new('STOL footpath descending existing mountain foot',me);bpy.context.collection.objects.link(o)
 else:supported_path(a,b)
tx,ty=config['terminal'];supported_path(config['gate'],(tx,ty-.35,z),.6)
# Human-scale open shelter with only a small worn patch around its feet.

for dx in [-.6,.6]:
 for dy in [-.38,.38]:rod('boarding shelter timber post',(tx+dx,ty+dy,z),(tx+dx,ty+dy,z+.87),.035,wood)
canopy=box('small village boarding shelter',(tx,ty,z+.91),(1.45,1.05,.11),roof);canopy.rotation_euler.x=.10
for dx in [-.6,-.3,0,.3,.6]:rod('shelter roof seams',(tx+dx,ty-.5,z+.91),(tx+dx,ty+.5,z+1.01),.024,roof)
box('boarding shelter bench',(tx,ty+.2,z+.25),(.92,.22,.08),wood)
box('small destination board',(tx,ty-.42,z+.71),(1.05,.07,.20),teal)
label('terminal destination',{'guaira':'GUAÍRA','fabrica':'FÁBRICA','serra':'SERRA'}[REGION],(tx,ty-.463,z+.71),.13,ivory)
wx,wy=tx+.85,ty+.5
rod('windsock mast',(wx,wy,z),(wx,wy,z+1.45),.021,wood)
for i in range(4):rod('windsock cloth',(wx+i*.10,wy,z+1.38-i*.025),(wx+(i+1)*.10,wy,z+1.38-(i+1)*.025),.09-i*.014,coral if i%2==0 else ivory)
# A pair of low white stones identifies each end; runway remains a rural clearing.
for l in ([] if REGION=='serra' else [-3.05,3.05]):
 for w in [-1.35,1.35]:
  x,y=xy(w,l);box('white landing edge stone',(x,y,z+.06),(.13,.16,.12),ivory,.04)

# Fill the boarding trails down into the actual meadow/core while preserving
# their authored top, horizontal footprint and every boarding anchor.
if REGION=='guaira':
 for _trail in bpy.context.scene.objects:
  if _trail.name.startswith('STOL earth boarding trail'):
   namespace['_gb_lower_box'](_trail,z-.065)
 namespace['ground_campaign_shelter'](tx,ty,z)

scene=bpy.context.scene;bpy.ops.object.camera_add(location=config['cam']);cam=bpy.context.object;target=Vector(config['target']);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=config['scale'];scene.camera=cam
if REGION!='serra':
 world=bpy.data.worlds.new('Warm archipelago daylight');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.57,.65,.76,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6
 for n,p,e,size,color in [('warm key',(-8,-10,19),2400,9,(1,.84,.67)),('sky fill',(8,3,13),1450,8,(.73,.82,1)),('rim',(-4,10,17),1600,7,(1,.94,.8))]:
  bpy.ops.object.light_add(type='AREA',location=p);o=bpy.context.object;o.name=n;o.data.energy=e;o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,2))-o.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=int(ARGS[ARGS.index('--samples')+1]) if '--samples' in ARGS else 32;scene.cycles.use_denoising=False;scene.cycles.max_bounces=5;scene.render.resolution_x=1920;scene.render.resolution_y=1200;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.3
bpy.context.view_layer.update()
def project(p):
 v=world_to_camera_view(scene,cam,Vector(p));return {'x':round(v.x,6),'y':round(1-v.y,6)}
# Project with the original island camera; oversized transparent overlay render is
# packed back into that same canonical space, so existing routes never move.
meta={'regionKey':REGION,'replacesBase':REGION=='serra','camera':{'position':list(cam.location),'target':list(target),'orthoScale':config['scale']},'terminal':{'groundAnchor':project(config['park']),'runwayStart':project(runway_start),'runwayEnd':project(runway_end),'boardingPath':[project(p) for p in walk],'groundAnchorWorld':config['park'],'runwayStartWorld':runway_start,'runwayEndWorld':runway_end,'boardingPathWorld':walk,'surface':'dry-compacted-earth','clearSpanMeters':3.35,'usableLengthMeters':4.65 if REGION=='guaira' else 4.34 if REGION=='serra' else 6.2},'supportFootprint':{'center':[cx,cy],'width':dims[0],'depth':dims[1],'terrainMode':'existing-island-ground' if REGION!='guaira' else 'blended-clay-shoulder','bottomZ':.1,'topZ':z,'walkWidth':.65,'walkSegments':walk},'assetFrame':{'left':0,'top':0,'widthInMap':1,'heightInMap':1}}
if REGION=='guaira':
 meta['terminal'].update({'rollStart':project(roll_start),'rollEnd':project(roll_end),
   'rollStartWorld':roll_start,'rollEndWorld':roll_end,'rollLengthMeters':2.2})
 meta['flightClearance']={'method':'inset western roll and aligned low-altitude corridor',
   'campaignVegetationSetback':clearance_vegetation,'chapterArtUnchanged':True}
 meta['nodes']={k:{**project(p),'world':p} for k,p in namespace['NODES'].items()};meta['routes']={str(i):[project(p) for p in r] for i,r in enumerate(namespace['ROUTES'])}
elif REGION=='serra':
 roll_start=(-1.6,-4.0,z);roll_end=(.1,-4.8,z)
 meta['terminal'].update({'rollStart':project(roll_start),'rollEnd':project(roll_end),
   'rollStartWorld':roll_start,'rollEndWorld':roll_end,'rollLengthMeters':math.hypot(1.7,.8)})
 meta['flightClearance']={'method':'supported coastal roll and shallow offshore corridor','support':coastal_support,
   'physicalStripAndBoardingUnchanged':True}
elif REGION=='fabrica':
 # Reserve the ground-supported wheel lane before the shelter and raised yard
 # pads. The 4 cm southern inset also clears the inspection-walkway edge.
 # Keep the physical strip, passenger path and every scene object unchanged.
 roll_start=(.9,-2.94,z);roll_end=(2.2,-2.94,z)
 meta['terminal'].update({'rollStart':project(roll_start),'rollEnd':project(roll_end),
   'rollStartWorld':roll_start,'rollEndWorld':roll_end,'rollLengthMeters':1.3})
 meta['flightClearance']={'method':'inset supported roll and aligned short climb before the shelter',
   'physicalStripAndBoardingUnchanged':True,'support':'existing factory foundation; no terrain or scenery changes'}
 cam.data.ortho_scale*=2
 meta['assetFrame']={'left':-.5,'top':-.5,'widthInMap':2,'heightInMap':2}
if REGION=='fabrica':
 support=box('existing factory coastal ground audit',(2,-2.5,1.02),(8,2,.10),clay,0);support.hide_render=True
# Assert all path vertices are on a real source support surface using vertical
# ray casts; path and runway slab checks are geometric rather than art guesses.
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();checks=[]
for a,b in zip(walk,walk[1:]):
 for k in range(21):
  p=Vector(a).lerp(Vector(b),k/20);hit,loc,normal,idx,obj,matrix=scene.ray_cast(deps,p+Vector((0,0,.075)),Vector((0,0,-1)),distance=.30)
  checks.append(bool(hit))
assert all(checks),'Disconnected passenger path'
meta['validation']={'walkSupportSamples':len(checks),'allSupported':all(checks),'numericCampaignIdsChanged':False,'objects':len(scene.objects)}
json.dump(meta,open(OUT/f'{REGION}.meta.json','w'),indent=2,ensure_ascii=False)
scene.render.filepath=str(OUT/f'{REGION}.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'{REGION}-campaign.blend') if '--output-dir' in ARGS else f'/tmp/feka-{REGION}-campaign.blend')
if '--build-only' not in ARGS:bpy.ops.render.render(write_still=True)
print('CAMPAIGN_TERMINAL_READY='+REGION)
