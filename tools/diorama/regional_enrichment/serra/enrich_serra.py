"""Source-grounded Serra polish. Pure scratch authoring, no repo mutation.
blender -b -t 8 -P enrich_serra.py -- --output-dir final --samples 128 --percentage 100
"""
from pathlib import Path
import argparse,sys,runpy,bpy,bmesh,math,random,json,hashlib,collections
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parent
p=argparse.ArgumentParser();p.add_argument('--output-dir',default=str(ROOT/'final'));p.add_argument('--samples',type=int,default=96);p.add_argument('--percentage',type=int,default=100);p.add_argument('--build-only',action='store_true');p.add_argument('--base-source');a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
OUT=Path(a.output_dir).resolve();OUT.mkdir(parents=True,exist_ok=True)
ns=runpy.run_path(str(Path(a.base_source).resolve() if a.base_source else ROOT/'source/serra_baseline.py'),init_globals={'FEKA_SERRA_OUT':str(OUT),'FEKA_SERRA_BUILD_ONLY':True})
scene=ns['scene'];cam=ns['cam'];meta=ns['meta'];base=set(scene.objects);rng=random.Random(202610014)
def signature(o):
 d={'name':o.name,'type':o.type,'matrix':[list(row) for row in o.matrix_world],'modifiers':[(m.type,m.width if m.type=='BEVEL' else None,m.segments if m.type=='BEVEL' else None) for m in o.modifiers]}
 if o.type=='MESH':d.update(vertices=[list(v.co) for v in o.data.vertices],faces=[list(f.vertices) for f in o.data.polygons])
 elif o.type=='CURVE':d.update(bevel=o.data.bevel_depth,splines=[[[*p.co] for p in s.points] for s in o.data.splines])
 return hashlib.sha256(json.dumps(d,sort_keys=True).encode()).hexdigest()
bpy.context.view_layer.update();baseline={o.name:signature(o) for o in base}
lights={o.name:{'location':list(o.location),'energy':o.data.energy,'color':list(o.data.color),'size':o.data.size} for o in base if o.type=='LIGHT'}
# Keep Serra's silver/lilac identity. Rock richness comes from low contrast mineral bands,
# micro relief and attached facets, not reshaping any existing cliff or its crown.
def strata(material):
 nt=material.node_tree;bs=nt.nodes.get('Principled BSDF');basecol=tuple(bs.inputs['Base Color'].default_value[:3]);tex=nt.nodes.new('ShaderNodeTexCoord');geo=nt.nodes.new('ShaderNodeVectorMath');geo.operation='MULTIPLY';geo.inputs[1].default_value=(1.1,1.1,5.2);nt.links.new(tex.outputs['Object'],geo.inputs[0]);noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=1.4;noise.inputs['Detail'].default_value=3;noise.inputs['Roughness'].default_value=.62;nt.links.new(geo.outputs['Vector'],noise.inputs['Vector']);ramp=nt.nodes.new('ShaderNodeValToRGB');r=ramp.color_ramp
 for e in list(r.elements)[1:]:r.elements.remove(e)
 for i,(pos,factor,tint) in enumerate([(.13,.71,(.98,.98,1.02)),(.31,.92,(1,1,1.025)),(.43,1.08,(1,1,1)),(.59,.97,(1.015,1,1)),(.70,.83,(1.03,1.015,.99)),(.84,1.11,(1,1,1))]):
  e=r.elements[0] if i==0 else r.elements.new(pos);e.position=pos;e.color=tuple(min(1,v*factor*t) for v,t in zip(basecol,tint))+(1,)
 nt.links.new(noise.outputs['Fac'],ramp.inputs[0]);nt.links.new(ramp.outputs[0],bs.inputs['Base Color']);b=nt.nodes.new('ShaderNodeBump');b.inputs['Strength'].default_value=.19;b.inputs['Distance'].default_value=.048;nt.links.new(noise.outputs['Fac'],b.inputs['Height']);nt.links.new(b.outputs[0],bs.inputs['Normal'])
for material in [ns['stone'],ns['light'],ns['shadow']]:strata(material)
# Ordered long-grain materials make timber feel sawn rather than plastic.
for material in [ns['wood'],ns['timber']]:
 nt=material.node_tree;bs=nt.nodes.get('Principled BSDF');rgb=tuple(bs.inputs['Base Color'].default_value[:3]);tex=nt.nodes.new('ShaderNodeTexCoord');v=nt.nodes.new('ShaderNodeVectorMath');v.operation='MULTIPLY';v.inputs[1].default_value=(3,38,5);nt.links.new(tex.outputs['Generated'],v.inputs[0]);n=nt.nodes.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=2.2;n.inputs['Detail'].default_value=2;nt.links.new(v.outputs[0],n.inputs['Vector']);r=nt.nodes.new('ShaderNodeValToRGB');r.color_ramp.elements[0].position=.18;r.color_ramp.elements[0].color=tuple(c*.73 for c in rgb)+(1,);r.color_ramp.elements[1].position=.85;r.color_ramp.elements[1].color=tuple(min(1,c*1.17) for c in rgb)+(1,);nt.links.new(n.outputs['Fac'],r.inputs[0]);nt.links.new(r.outputs[0],bs.inputs['Base Color'])
print('PROGRESS: baseline and materials ready',flush=True)
# Non-displacement mottling on the original moss crowns.
nt=ns['grass'].node_tree;bs=nt.nodes['Principled BSDF'];n=nt.nodes.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=9;n.inputs['Detail'].default_value=2;r=nt.nodes.new('ShaderNodeValToRGB');r.color_ramp.elements[0].color=(.065,.13,.026,1);r.color_ramp.elements[1].color=(.23,.34,.074,1);nt.links.new(n.outputs['Fac'],r.inputs[0]);nt.links.new(r.outputs[0],bs.inputs['Base Color'])
mat=ns['mat'];silver=mat('Serra fresh silver limestone',(.73,.75,.76));silverhi=mat('Serra chalky fractured limestone',(.85,.85,.79));silvermid=mat('Serra cool slate facets',(.55,.60,.67));moss=mat('Serra alpine moss',(.35,.48,.22));leaf=mat('Serra mountain juniper',(.22,.40,.24));leafhi=mat('Serra alpine leaf tips',(.42,.56,.27));dry=mat('Serra alpine seedheads',(.71,.67,.36));flower=mat('Serra gentian violet',(.53,.39,.69));white=mat('Serra alpine ivory flowers',(.94,.91,.75));clay=mat('Serra roof tile overlap',(.60,.22,.14));steelhi=mat('Serra galvanized joint edges',(.36,.48,.53),.43,.35);nail=mat('Serra iron bolt heads',(.19,.24,.27),.38,.48)
for material in [silver,silverhi,silvermid]:strata(material)
group=''
def tag(o):
 effective=group+'_'+o.name.split('.')[0] if group.startswith('station_') else group
 o.name='enrich_'+group+' '+o.name;o['enrichment_group']=effective;return o
def mesh(n,v,f,m):return tag(ns['mesh'](n,v,f,m))
def from_bmesh(n,bm,p,m):
 me=bpy.data.meshes.new(n);bm.to_mesh(me);bm.free();o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);o.location=p;o.data.materials.append(m);return tag(o)
def cube(n,p,d,m,r=.018):
 bm=bmesh.new();bmesh.ops.create_cube(bm,size=1)
 for v in bm.verts:v.co=Vector((v.co.x*d[0],v.co.y*d[1],v.co.z*d[2]))
 o=from_bmesh(n,bm,p,m)
 if r:ns['bevel'](o,r)
 return o
def cyl(n,p,r,d,m,verts=12):
 bm=bmesh.new();bmesh.ops.create_cone(bm,cap_ends=True,cap_tris=False,segments=verts,radius1=r,radius2=r,depth=d);o=from_bmesh(n,bm,p,m);ns['bevel'](o,.012);return o
def beam(n,a,b,r,m):
 a,b=Vector(a),Vector(b);o=cyl(n,(a+b)/2,r,(b-a).length,m,12);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def ico(n,p,s,m,sub=1):
 bm=bmesh.new();bmesh.ops.create_icosphere(bm,subdivisions=sub,radius=1);o=from_bmesh(n,bm,p,m);o.scale=s;return o
def torus(n,p,r,t,m,rot=(0,0,0)):
 bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=t,major_segments=24,minor_segments=6,location=p,rotation=rot);o=bpy.context.object;o.name=n;o.data.materials.append(m);return tag(o)
# Attached broken facets are shallow prisms following each original rock face.
rocks=[o for o in base if o.type=='MESH' and len(o.data.vertices)==36 and any(t in o.name for t in ['crag','escarpment','buttress','needle','limestone','mountain foot'])]
for rock in sorted(rocks,key=lambda o:o.name):
 for fi,f in enumerate(rock.data.polygons):
  if len(f.vertices)!=4 or f.normal.z>.65:continue
  pts=[rock.matrix_world@rock.data.vertices[j].co for j in f.vertices];normal=f.normal.normalized();center=sum(pts,Vector())/4
  if normal.y>.5 or center.z>4.8:continue
  for k in range(1):
   group='fracture_'+rock.name+'_'+str(fi)+'_'+str(k);u=.50;v=rng.uniform(.22,.76);width=rng.uniform(.66,.88);height=rng.uniform(.075,.13)
   def facept(x,y):return pts[0].lerp(pts[1],x).lerp(pts[3].lerp(pts[2],x),y)
   uv=[(u-width*.5,v-height*.30),(u+width*.38,v-height*.48),(u+width*.55,v+height*.1),(u+width*.21,v+height*.50),(u-width*.5,v+height*.30)]
   front=[facept(max(.03,min(.97,x)),max(.03,min(.97,y)))+normal*rng.uniform(.012,.030) for x,y in uv];back=[q-normal*.08 for q in front];vs=front+back;faces=[tuple(range(5)),tuple(range(9,4,-1))]+[(j,(j+1)%5,(j+1)%5+5,j+5) for j in range(5)];o=mesh('attached fractured face',[tuple(q) for q in vs],faces,rock.data.materials[f.material_index]);ns['bevel'](o,.015)
# New growth rooted on actual existing geological tops; no free-floating bushes.
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();verts=[];faces=[]
for o in rocks:
 e=o.evaluated_get(deps);me=e.to_mesh();ofs=len(verts);verts.extend([o.matrix_world@v.co for v in me.vertices]);faces.extend([tuple(ofs+j for j in f.vertices) for f in me.polygons]);e.to_mesh_clear()
terrain=BVHTree.FromPolygons(verts,faces)
def ground(x,y):
 hit=terrain.ray_cast(Vector((x,y,30)),Vector((0,0,-1)),60);return hit[0].z if hit[0] is not None else None
def leaves(x,y,z,s):
 for j in range(5):
  ang=j*math.tau/5+rng.uniform(-.2,.2);L=rng.uniform(.65,1)*s;tip=Vector((x+math.cos(ang)*L,y+math.sin(ang)*L,z+.30*s));side=Vector((-math.sin(ang),math.cos(ang),0))*s*.16;root=Vector((x,y,z));mid=root.lerp(tip,.52)+Vector((0,0,s*.21));mesh('folded alpine leaf',[tuple(root),tuple(mid+side),tuple(tip),tuple(mid),tuple(mid-side)],[(0,1,3),(1,2,3),(2,4,3),(4,0,3)],leafhi if j%3==0 else leaf)
def cluster(name,x,y,s=.5,flowers=True):
 global group
 z=ground(x,y)
 if z is None:return
 group='growth_'+name;s*=1.30
 patch=[]
 for j in range(12):
  ang=j*math.tau/12;xx=x+math.cos(ang)*s*.65*rng.uniform(.82,1.06);yy=y+math.sin(ang)*s*.46*rng.uniform(.82,1.05);zz=ground(xx,yy)
  if zz is None or abs(zz-z)>.24:continue
  patch.append((xx,yy,zz+.018))
 if len(patch)>=3:mesh('irregular rooted moss island',patch,[tuple(range(len(patch)))],moss)
 for k in range(6):
  ang=k*2.4;xx=x+math.cos(ang)*s*.3;yy=y+math.sin(ang)*s*.25;zz=ground(xx,yy)
  if zz is None or abs(zz-z)>.3:continue
  ico('low juniper cushion',(xx,yy,zz+.08*s),(s*.34,s*.29,s*.25),leaf if k%2 else leafhi)
  leaves(xx,yy,zz+.03,s*.42)
 for k in range(5 if flowers else 2):
  xx=x+rng.uniform(-.28,.28)*s;yy=y+rng.uniform(-.24,.24)*s;zz=ground(xx,yy)
  if zz is None or abs(zz-z)>.3:continue
  h=s*rng.uniform(.20,.51);beam('fine alpine stem',(xx,yy,zz),(xx+.04*s,yy,zz+h),.009,leaf)
  if flowers:
   for j in range(5):
    ang=j*math.tau/5;ico('tiny grouped alpine bloom',(xx+math.cos(ang)*s*.042,yy+math.sin(ang)*s*.042,zz+h),(s*.047,s*.04,s*.024),flower if k%3 else white)
   ico('flower seed heart',(xx,yy,zz+h+.009),(s*.024,s*.024,s*.018),dry)
# Deliberate scenic pockets: ledges below the walkways, rear summits and quiet station margins.
for i,(x,y,s) in enumerate([(-4.95,-2.50,.62),(-4.20,-2.68,.68),(-3.70,-2.78,.48),(-4.92,-1.84,.58),(-4.5,-2.10,.44),(-5.42,-3.8,.4),(-2.70,-3.18,.75),(-2.25,-3.25,.55),(-2.15,-2.90,.40),(1.45,-3.36,.85),(2.1,-3.52,.58),(2.4,-3.27,.40),(5.75,-1.1,.4),(5.8,-.45,.48),(-4.98,.30,.43),(-3.86,.67,.57),(-3.61,1.27,.46),(-3.95,2.13,.43),(-3.58,2.82,.39),(-1.10,3.71,.33),(-.88,4.16,.28),(-.85,.45,.5),(-.55,.87,.43),(-1.36,.88,.5),(3.93,-.35,.63),(3.48,-.37,.54),(4.46,-.4,.58),(5.55,2.84,.36),(5.72,2.65,.4),(3.08,3.10,.42),(4.70,2.88,.45)]):cluster(str(i),x,y,s)
# Dwarf fir families complement the original single trees, never become a new wall of foliage.
for i,(x,y,s) in enumerate([(-4.60,-2.26,.45),(-2.45,-3.26,.67),(1.77,-3.45,.58),(1.40,-3.3,.32),(4.04,-.35,.50),(-3.88,2.35,.40),(-3.57,2.1,.29),(5.57,2.74,.32)]):
 z=ground(x,y)
 if z is None:continue
 group='fir_'+str(i);prior=set(scene.objects);ns['fir']('dwarf alpine fir',x,y,z+.015,s)
 for o in set(scene.objects)-prior:tag(o)
# Small cascading alpine juniper tufts follow the existing cliff rings, rooted at moss margins.
for ri,rock in enumerate(sorted(rocks,key=lambda o:o.name)):
 if rock.name=='continuous mountain foot' or 'needle' in rock.name:continue
 center=sum((v.co for v in rock.data.vertices),Vector())/len(rock.data.vertices)
 for edge in [5,6]:
  group='cliff_juniper_'+str(ri)+'_'+str(edge)
  top=(rock.data.vertices[27+edge].co+rock.data.vertices[27+(edge+1)%9].co)*.5
  low=(rock.data.vertices[18+edge].co+rock.data.vertices[18+(edge+1)%9].co)*.5
  for j in range(5):
   t=j*.095;p=top.lerp(low,t);outward=Vector((p.x-center.x,p.y-center.y,0)).normalized();p+=outward*.045
   leaves(p.x,p.y,p.z,.23*(1-j*.10))
print('PROGRESS: geology and vegetation authored',flush=True)
# Exposed rock between the two planted pockets stays mostly empty.
for i,(x,y,s) in enumerate([(-.42,-3.42,.26),(-.13,-3.49,.15),(.12,-3.23,.11)]):
 z=ground(x,y)
 if z is not None:
  group='quiet_stone_'+str(i);ico('small weathered limestone',(x,y,z+s*.30),(s,s*.73,s*.55),silverhi)
# Station craftsmanship: inset gables, tile overlaps, timber eaves and real door fittings.
for name,x,y,z,w,d,h in [('lower',-4.4,1.25,2.83,1.85,1.18,1.28),('upper',4,3.08,5.25,2.1,1.4,1.62)]:
 group='station_'+name;xx0=x-w/2-.20;xx1=x+w/2+.20;y0=y-d/2-.16;y1=y+d/2+.16;eave=z+h;peak=eave+.65
 for sx in [-1,1]:
  xx=x+sx*(w/2-.015);mesh('plaster gable',[(xx,y-d/2,eave-.015),(xx,y+d/2,eave-.015),(xx,y,peak-.045)],[(0,1,2)],ns['cream'])
  for yy in [y0,y1]:beam('gable timber edge',(x+sx*(w/2+.21),yy,eave-.035),(x+sx*(w/2+.21),y,peak-.035),.039,ns['wood'])
  beam('roof underside brace',(xx,y0+.1,eave-.22),(xx,y,eave+.38),.045,ns['wood'])
 for yy in [y0,y1]:beam('continuous timber eave',(xx0,yy,eave-.04),(xx1,yy,eave-.04),.047,ns['wood'])
 for side in [-1,1]:
  for t in [.25,.50,.75]:
   yy=y+side*(d/2+.16)*t;zz=peak-.65*t+.018;beam('overlapping ceramic tile rows',(xx0+.02,yy,zz),(xx1-.02,yy,zz),.014,clay)
 # Door hardware stays flush with its existing non-walk wall.
 for i in range(4):cube('door plank seam',(x-w*.24-.14+i*.093,y-d/2-.073,z+h*.4),(.012,.009,h*.71),ns['timber'],.001)
 for zz in [z+.25,z+h*.67]:cube('forged door hinge',(x-w*.24-.08,y-d/2-.085,zz),(.24,.025,.038),nail,.005)
 knob=cyl('brass door handle',(x-w*.24+.125,y-d/2-.10,z+h*.38),.026,.045,ns['gold']);knob.rotation_euler.x=math.pi/2
 cube('stone window sill',(x+w*.20,y-d/2-.108,z+h*.56-.31),(.64,.17,.065),silverhi,.01)
 for sx in [-1,1]:
  xx=x+sx*(w/2-.05)
  for zz in [z+.17,z+h-.20]:
   cube('timber iron strap',(xx,y-d/2-.079,zz),(.16,.029,.15),steelhi,.008)
   for dx in [-.048,.048]:ico('strap rivet',(xx+dx,y-d/2-.10,zz),(.018,.016,.019),nail)
# Riveted tower collars, grounded soleplates and visible cross-bracing on existing rear towers.
for name,x,y,z,h in [('lower',-5.25,1.90,2.84,2.6),('upper',4.65,3.35,5.25,2.65)]:
 group='tower_'+name
 for dx in [-.24,.24]:
  cube('steel soleplate',(x+dx,y,z+.03),(.28,.32,.055),steelhi,.01)
  for dz in [.44,1.3,2.0]:
   cube('upright collar',(x+dx,y-.116,z+dz),(.19,.035,.15),steelhi,.009)
   for ox in [-.06,.06]:ico('tower collar bolt',(x+dx+ox,y-.142,z+dz),(.019,.017,.019),nail)
 for lo in [.48,1.29]:beam('rear steel bracing',(x-.20,y+.12,z+lo),(x+.20,y+.12,z+lo+.70),.025,steelhi)
# Bridge connections and short braces sit entirely underneath existing timber decks.
for ob in sorted(base,key=lambda o:o.name):
 if 'anchored timber post' not in ob.name:continue
 top=max((ob.matrix_world@Vector(p)).z for p in ob.bound_box);x,y=ob.location.x,ob.location.y
 group='post_join_'+ob.name.replace('anchored timber post','joint')
 cube('saddle plate',(x,y-.081,top-.10),(.22,.027,.20),steelhi,.009)
 for dx in [-.065,.065]:ico('saddle bolt',(x+dx,y-.103,top-.11),(.018,.015,.018),nail)
 if top>2.0:beam('short underdeck brace',(x,y,top-.62),(x+.31,y,top-.14),.047,ns['wood'])
# A compact maintenance set sits beside the lower station, not in the passenger route.
group='lower_station_kit';x,y,z=-3.39,1.53,2.66
cube('timber tool locker',(x,y,z+.27),(.38,.48,.54),ns['wood'],.026)
for i in range(3):cube('locker slat',(x+.197,y-.16+i*.16,z+.27),(.023,.105,.48),ns['timber'],.005)
for zz in [z+.09,z+.43]:cube('locker iron band',(x+.211,y,zz),(.022,.49,.041),steelhi,.005)
for rr in [.10,.135,.17]:torus('coiled cable on locker',(x,y,z+.56),rr,.013,ns['wood'])
print('PROGRESS: station details authored',flush=True)
# Guard every addition against both body and screen corridors, including the passenger exit.
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
paths=[]
for kind,routes in meta['worldRoutes'].items():
 for i,r in enumerate(routes):paths.append((kind+':'+str(i),r['world']))
paths.append(('passenger-exit',[(3.55,1.18,5.45),(5.2,1.18,5.45),(9.35,1.18,5.45),(9.35,3.3,5.45)]))
paths += [('maintenance-ride:'+str(i),r) for i,r in enumerate(ns['RIDES'])]
verts=[];tris=[];objects=[]
for ob in scene.objects:
 if not ob.get('enrichment_group') or ob.type not in {'MESH','CURVE'}:continue
 e=ob.evaluated_get(deps);me=e.to_mesh();me.calc_loop_triangles();ofs=len(verts);verts.extend([ob.matrix_world@v.co for v in me.vertices]);tris.extend([tuple(ofs+j for j in t.vertices) for t in me.loop_triangles]);objects.extend([ob]*len(me.loop_triangles));e.to_mesh_clear()
bvh=BVHTree.FromPolygons(verts,tris,all_triangles=True);right=cam.matrix_world.to_quaternion()@Vector((1,0,0));up=cam.matrix_world.to_quaternion()@Vector((0,1,0));toward=cam.matrix_world.to_quaternion()@Vector((0,0,1));removed={};raycount=0
for route,points in paths:
 for a0,b0 in zip(points,points[1:]):
  aa,bb=Vector(a0),Vector(b0);steps=max(2,math.ceil((bb-aa).length/.055));d=bb-aa;side=Vector((-d.y,d.x,0)).normalized()
  for i in range(steps+1):
   foot=aa.lerp(bb,i/steps)
   for xx in [-.32,-.24,-.12,0,.12,.24,.32]:
    for h in [.13,.27,.43,.59,.75,.91,1.05]:
     q=foot+right*xx+Vector((0,0,h));hit,n,idx,dist=bvh.ray_cast(q+toward*.012,toward,40);raycount+=1
     if hit is not None:removed.setdefault(objects[idx]['enrichment_group'],{'route':route,'object':objects[idx].name,'method':'conservative-full-body-screen'})
   for off in [-.32,0,.32]:
    q=foot+side*off;hit,n,idx,dist=bvh.ray_cast(q+Vector((0,0,1.10)),Vector((0,0,-1)),.95);raycount+=1
    if hit is not None:removed.setdefault(objects[idx]['enrichment_group'],{'route':route,'object':objects[idx].name,'method':'physical-headroom'})
for ob in list(scene.objects):
 if ob.get('enrichment_group') in removed:bpy.data.objects.remove(ob,do_unlink=True)
bpy.context.view_layer.update();assert all(signature(o)==baseline[o.name] for o in base),'Original geometry changed'
# Keep moving carrier source objects in blend for audit. Hide only for static rendering.
meta_original=json.dumps(meta,sort_keys=True);scene['serra_metadata']=json.dumps(meta)
scene.render.resolution_x=1920;scene.render.resolution_y=1200;scene.render.resolution_percentage=a.percentage;scene.cycles.samples=a.samples;scene.cycles.use_denoising=False
json.dump(meta,open(OUT/'serra-prototype.meta.json','w'),indent=2)
audit={'originalGeometryCount':len(base),'originalGeometrySignaturesUnchanged':True,'newObjectCount':sum(bool(o.get('enrichment_group')) for o in scene.objects),'newGroups':dict(collections.Counter(o.get('enrichment_group') for o in scene.objects if o.get('enrichment_group'))),'preflightConservativeRays':raycount,'removedGroups':removed,'camera':meta['camera'],'lightsUnchanged':lights,'worldUnchanged':{'name':scene.world.name,'exposure':scene.view_settings.exposure},'contract':'Original surfaces, paths, stage nodes, carriers, cable curves, camera and lighting remain exact. Only new geometry and existing material shading changed.'}
json.dump(audit,open(OUT/'serra-enrichment-audit.json','w'),indent=2);json.dump(baseline,open(OUT/'baseline-geometry-signatures.json','w'),indent=2)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'serra-enriched.blend'))
if not a.build_only:
 for ob in scene.objects:
  if ob.name.startswith(('maintenance carrier A','maintenance carrier B')):ob.hide_render=True
 scene.render.filepath=str(OUT/'serra-enriched.png');bpy.ops.render.render(write_still=True)
print('SERRA_ENRICHMENT='+json.dumps({'out':str(OUT),'newObjects':audit['newObjectCount'],'removed':list(removed),'rays':raycount}),flush=True)
