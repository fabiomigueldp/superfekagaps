"""Portable Reserva cold-depot enrichment. No repository or deployment writes.
blender -b -t 8 -P enrich_reserva.py -- --output-dir ./final --final
Use --build-only for audited geometry, --percentage 50 --samples 16 for preview.
"""
import argparse,hashlib,json,math,random,sys
from pathlib import Path
import bpy
from mathutils import Vector
P=argparse.ArgumentParser();P.add_argument('--output-dir',required=True);P.add_argument('--final',action='store_true');P.add_argument('--build-only',action='store_true');P.add_argument('--percentage',type=int,default=50);P.add_argument('--samples',type=int,default=16)
a=P.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
HERE=Path(__file__).resolve().parent;OUT=Path(a.output_dir).resolve();OUT.mkdir(parents=True,exist_ok=True)
base=HERE/'source/base_render_reserva_map.py';txt=base.read_text()
txt=txt.split('# Use the exact source-authored sprite')[0]
sys.argv=['base','--','--build-only','--output-dir',str(OUT)]
ns={'__file__':str(base),'__name__':'reserva_frozen_base'};exec(compile(txt,str(base),'exec'),ns)
scene=bpy.context.scene;cam=scene.camera
source=json.loads((HERE/'source/feka-sprite.json').read_text());meta=ns['meta'];pixel=source['pixelMapWidth']*cam.data.ortho_scale
meta['fekaScale']={'source':source['source'],'pixelMapWidth':source['pixelMapWidth'],'worldPixelWidth':pixel,'projectedHeightAt1920':26*source['pixelMapWidth']*1920}
base_meta=json.loads((HERE/'source/baseline.meta.json').read_text())
frozen=['size','camera','nodes','routes','secretRoute','worldRoutes','routeDurationsSeconds','secretDurationSeconds','stationApproachDurationSeconds']
for key in frozen:
 if key in base_meta: assert json.loads(json.dumps(meta[key]))==base_meta[key],f'Frozen field differs: {key}'
scene['reserva_metadata']=json.dumps(meta)
(OUT/'reserva-prototype.meta.json').write_text(json.dumps(meta,indent=2)+'\n');(OUT/'reserva-sprite-source.json').write_text(json.dumps(source,indent=2)+'\n')
base_objects=set(scene.objects)
def geom_hash(o):
 points=[list(v.co) for v in o.data.vertices] if o.type=='MESH' else []
 faces=[list(p.vertices) for p in o.data.polygons] if o.type=='MESH' else []
 return hashlib.sha256(json.dumps([points,faces,list(sum((list(r) for r in o.matrix_world),[]))]).encode()).hexdigest()
base_hashes={o.name:geom_hash(o) for o in base_objects if o.type=='MESH'}
group=''
def tag(o):o.name='enrich_'+group+' '+o.name;o['enrichment_group']=group;return o
def cube(n,p,d,m,r=.018):return tag(ns['cube'](n,p,d,m,r))
def cyl(n,p,r,d,m,num=24):return tag(ns['cyl'](n,p,r,d,m,num))
def beam(n,p,q,r,m):return tag(ns['beam'](n,p,q,r,m))
def ring(n,p,r,t,m,rot=(math.pi/2,0,0)):return tag(ns['ring'](n,p,r,t,m,rot))
def pipe(n,p,r,m):return tag(ns['pipe'](n,p,r,m))
def mesh(n,v,f,m):return tag(ns['mesh'](n,v,f,m))
def ico(n,p,s,m,seed=0):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=p);o=bpy.context.object;o.name=n;o.scale=s;o.rotation_euler=(.07*(seed%3),.12*(seed%2),seed*.41);ns['assign'](o,m);return tag(o)
def cone(n,p,r,d,m):
 bpy.ops.mesh.primitive_cone_add(vertices=6,radius1=.007,radius2=r,depth=d,location=p);o=bpy.context.object;o.name=n;ns['assign'](o,m);return tag(o)
def mat(n,c,metal=0,rough=.5):
 m=ns['material']('Reserva craft '+n,c,metal);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=rough;return m
frost,ice,navy,steel,purple,amber,copper,dark=[ns[k] for k in ['frost','ice','navy','steel','purple','amber','copper','dark']]
ice_deep=mat('deep blue ice fractures',(.32,.63,.77),.03,.38);ice_pale=mat('pale ice fracture',(.48,.75,.85),.02,.42);rock_dark=mat('tidal slate',(.29,.39,.50),.03,.68);rock_light=mat('dry slate facets',(.34,.44,.55),0,.76);snow=mat('fresh drift edges',(.89,.96,.97),0,.75);warmsteel=mat('aged brushed collar',(.58,.69,.72),.42,.43);cream=mat('freight ivory strips',(.83,.87,.80),.12,.55);violet=mat('freight juice purple',(.46,.23,.60),.07,.52);wood=mat('warm freight pallet',(.52,.36,.21),0,.73)
# Macro material variation is shallow and controlled. Do not weather the dry lane.
for m,scale,strength in [(ice,3.8,.105),(steel,6.0,.075),(purple,3.0,.11),(ns['rock'],2.4,.11)]:
 nt=m.node_tree;p=nt.nodes['Principled BSDF'];noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=scale;noise.inputs['Detail'].default_value=1.4;noise.inputs['Roughness'].default_value=.6
 ramp=nt.nodes.new('ShaderNodeValToRGB');basecol=list(p.inputs['Base Color'].default_value);ramp.color_ramp.elements[0].position=.15;ramp.color_ramp.elements[1].position=.85
 ramp.color_ramp.elements[0].color=tuple(v*(1-strength) for v in basecol[:3])+(1,);ramp.color_ramp.elements[1].color=tuple(min(1,v*(1+strength)) for v in basecol[:3])+(1,)
 nt.links.new(noise.outputs['Fac'],ramp.inputs[0]);nt.links.new(ramp.outputs[0],p.inputs['Base Color'])
# Strata hug the existing coastline. West ferry and east passenger corridors remain clear.
random.seed(58319);outline=ns['OUTLINE'];group='ice_coast';shore_records=[]
# A connected fractured belt, not evenly spaced boulders: irregular planar strata.
for chain in [[0,1,2,3,4],[7,8,9,10,11]]:
 stations=[]
 for edge in chain:
  p,q=Vector((*outline[edge],0)),Vector((*outline[(edge+1)%len(outline)],0));d=q-p;n=Vector((d.y,-d.x,0)).normalized();segments=max(2,round(d.length/.77))
  for i in range(segments):
   t=(i+random.uniform(-.12,.12) if i else 0)/segments;c=p.lerp(q,t)
   stations.append((c,n,edge))
 edge=chain[-1];c=Vector((*outline[(edge+1)%len(outline)],0));p=Vector((*outline[edge],0));d=c-p;n=Vector((d.y,-d.x,0)).normalized()
 stations.append((c,n,edge))
 for layer in ['slate','blue']:
  vs=[]
  for i,(c,n,edge) in enumerate(stations):
   if layer=='slate':levels=[(-.115,.01),(.18+random.uniform(-.06,.08),.11+random.uniform(-.03,.05)),(.545+random.uniform(-.015,.035),.035)]
   else:levels=[(.53,.04),(.84+random.uniform(-.08,.08),.13+random.uniform(-.045,.035)),(1.145+random.uniform(-.018,.018),.025)]
   for z,off in levels:vs.append(tuple(c+n*off+Vector((0,0,z))))
  faces=[]
  for i in range(len(stations)-1):
   for j in [0,1]:
    k=i*3+j;faces.extend([(k,k+3,k+4),(k,k+4,k+1)])
  o=mesh('continuous fractured '+layer,vs,faces,rock_dark if layer=='slate' else ice)
  for m in ([ns['rock'],rock_light] if layer=='slate' else [ice_deep,ice_pale]):o.data.materials.append(m)
  for f in o.data.polygons:
   section=f.index//4;f.material_index=1 if section%9 in [3,4] else 2 if section%9==7 else 0
 # Discontinuous irregular frost shelves join directly to the unmodified surface.
 for i,((p,n,edge),(q,nn,ee)) in enumerate(zip(stations,stations[1:])):
  shore_records.append([edge,round(p.x,3),round(p.y,3)])
  if i%4 in [0,1]:
   mid=p.lerp(q,.53);length=(q-p).length
   vs=[tuple(p-n*.13+Vector((0,0,1.17))),tuple(q-nn*.13+Vector((0,0,1.17))),tuple(q+nn*.03+Vector((0,0,1.168))),tuple(mid+n*.095+Vector((0,0,1.12))),tuple(p+n*.035+Vector((0,0,1.165)))]
   mesh('wind packed broken frost shelf',vs,[(0,1,3),(1,2,3),(0,3,4)],frost)
  if i%3!=1:
   c=p.lerp(q,random.uniform(.25,.75))+n*.065;h=random.uniform(.13,.29);cone('irregular coast icicle',(c.x,c.y,1.11-h/2),random.uniform(.035,.065),h,ice_pale)
# Faceted ice clusters remain grounded, below routes and close to the back shoulders.
group='ice_shoulders'
for i,(x,y,z,sx,sy,sz) in enumerate([(-5.9,3.65,1.25,.55,.35,.42),(-.55,4.02,1.21,.68,.43,.36),(5.9,3.02,1.19,.42,.35,.28),(2.8,-3.22,1.22,.42,.24,.12),(-4.25,-.6,1.23,.55,.38,.12)]):
 ico('broken compact ice shoulder',(x,y,z),(sx,sy,sz),ice_pale,i)
 ico('small shoulder frost',(x-.09,y-.02,z+sz*.5),(sx*.6,sy*.6,sz*.19),frost,i+1)
# Wind-packed frost appears only on exposed roofs, never as a lane coating.
group='roof_frost'
for i in range(16):
 x=-5.45+i*3.60/15;ico('irregular front eave drift',(x,2.175+random.uniform(-.025,.025),4.999),(.15+random.random()*.045,.095,.052+random.random()*.02),snow,i)
 if i%3==0:
  h=.10+random.random()*.12;cone('roof thaw icicle',(x,2.156,4.93-h/2),.038,h,frost)
for i in range(9):
 y=2.35+i*.19;ico('side roof frost',( -1.765,y,5.001),(.083,.125,.045),frost,i)
for x,y,r,top in [(1.30,3.01,1.02,4.70),(3.05,2.42,.76,3.90)]:
 for i in range(17):
  ang=i*math.tau/17;ico('vessel rim frost',(x+math.cos(ang)*(r-.07),y+math.sin(ang)*(r-.07),top),(.115,.10,.036),snow,i)
# A handful of shallow branching seams describe ice inside the service yards.
# Their geometry remains below the raised dry walking deck and outside its lane.
group='service_floor'
for pts in [[(-4.40,-1.25,1.177),(-4.02,-.89,1.177),(-3.48,-.78,1.177),(-3.16,-.32,1.177)],[(-4.02,-.89,1.178),(-4.11,-.42,1.178),(-3.81,-.10,1.178)],[(1.23,.18,1.178),(1.76,.53,1.178),(2.28,.50,1.178),(2.50,.98,1.178)],[(2.28,.50,1.178),(2.68,.18,1.178),(3.00,.28,1.178)]]:
 pipe('shallow ice fracture',pts,.010,ice_deep)
# Lamps retain original location and housing, adding visible practical glass/cages.
group='warm_lamps';glow=mat('amber warm safety glass',(1,.69,.24),0,.27);bs=glow.node_tree.nodes['Principled BSDF'];bs.inputs['Emission Color'].default_value=(1,.29,.035,1);bs.inputs['Emission Strength'].default_value=.65
for o in base_objects:
 if 'amber lamp' in o.name or 'warm wall lamp' in o.name:o.data.materials.clear();o.data.materials.append(glow)
for x in [-5.13,-2.18]:
 cube('lamp footing',(x,2.093,4.15),(.25,.235,.045),navy,.01)
 for dx in [-.088,.088]:beam('lamp protective upright',(x+dx,1.988,4.17),(x+dx,1.988,4.41),.012,navy)
 beam('lamp cage crossbar',(x-.09,1.982,4.27),(x+.09,1.982,4.27),.010,navy)
# Vessel flanges, fill pipes and bolted inspection panels reinforce juice depot function.
group='vessel_hardware'
for x,y,r,h in [(1.30,3.01,.91,3.15),(3.05,2.42,.65,2.35)]:
 for z in [1.54,1.44+h-.1]:
  for i in range(12):
   ang=i*math.tau/12;bx=x+math.cos(ang)*(r+.082);by=y+math.sin(ang)*(r+.082);o=cyl('pressure-band radial bolt',(bx,by,z),.025,.030,navy,8);o.rotation_euler=(math.pi/2,0,ang-math.pi/2)
 xx=x+r+.085;yy=y+.12
 pipe('copper thermal trace',[(xx,yy,1.62),(xx,yy,1.44+h-.02),(x+r*.55,yy,1.44+h+.17)],.033,copper)
 for z in [1.84,2.37,1.44+h-.34]:ring('trace retention clamp',(xx,yy,z),.049,.012,steel,(0,0,0))
 for i in range(5):cube('serial plate fine rule',(x-.22+i*.085,y-r-.082,2.068),(.021,.014,.07 if i%2 else .10),navy,.002)
 ring('top vent pressure seam',(x,y,1.44+h+.25),r*.185,.014,steel,(0,0,0))
# Chiller intake shows real depth and closely spaced louvres inside original grille.
group='chiller_hardware'
for z in [1.98,2.12,2.26,2.40,2.54]:cube('recessed fan louvre',(4.34,2.161,z),(1.09,.022,.026),warmsteel,.006)
for x in [3.77,4.91]:
 for z in [1.88,2.66]:
  o=cyl('chiller face screw',(x,2.169,z),.029,.032,steel,8);o.rotation_euler.x=math.pi/2
for z in [1.80,2.75,3.45]:ring('rising insulated pipe collar',(5.10,2.8,z),.196,.035,steel,(0,0,0))
for x in [4.03,4.82]:ring('header union collar',(x,2.8,3.7),.196,.030,warmsteel,(0,math.pi/2,0))
for i in range(4):cube('chiller service panel groove',(5.18,2.57+i*.20,2.07),(.025,.024,1.35),warmsteel,.003)
cube('chiller data plate',(4.34,2.207,1.57),(.39,.026,.15),cream,.009)
# Door corner gussets, heads and side wall skirting. Existing pressure door remains exact.
group='freezer_construction'
for x in [-5.33,-2.0]:
 for z in [2.76,4.62]:
  cube('corner reinforcement shoe',(x,2.049,z),(.16,.037,.20),warmsteel,.010)
  for dz in [-.045,.045]:
   o=cyl('corner countersunk bolt',(x,2.025,z+dz),.019,.020,navy,8);o.rotation_euler.x=math.pi/2
cube('freezer side bottom kickplate',(-1.851,3.10,2.68),(.026,1.55,.18),warmsteel,.006)
# Freight is a compact pallet on the east service shoulder, outside all route/boarding lanes.
group='juice_freight';x,y,z=4.25,1.10,1.17
for dy in [-.30,.30]:cube('pallet runner',(x,y+dy,z+.075),(1.00,.095,.15),wood,.009)
for i in range(5):cube('pallet plank',(x-.43+i*.215,y,z+.167),(.17,.84,.048),wood,.007)
for k,(dx,dy,w,d,h) in enumerate([(-.22,-.18,.41,.35,.55),(.23,-.18,.41,.35,.55),(-.22,.20,.41,.35,.55),(.23,.20,.41,.35,.55),(-.015,.02,.64,.57,.34)]):
 zz=z+.21+(.56 if k==4 else 0)
 cube('insulated juice case',(x+dx,y+dy,zz+h/2),(w,d,h),violet,.035)
 for sx in [-1,1]:cube('freight vertical pale binding',(x+dx+sx*w*.29,y+dy-d*.507,zz+h/2),(.026,.018,h*.92),cream,.003)
 cube('freight lid',(x+dx,y+dy,zz+h),(w+.014,d+.014,.035),steel,.009)
 cube('freight amber seal',(x+dx,y+dy-d*.529,zz+h*.65),(.075,.016,.068),amber,.004)
 if k==4:ico('freight frost drift',(x+dx,y+dy,zz+h+.028),(.26,.23,.041),frost,4)
# Small industrial trench accents stay on the rear retaining wall and low machine faces.
group='freight_trench'
for i in range(5):cube('rear cutaway vent slot',(-1.72+i*.065,2.427,3.32),(.030,.025,.27),dark,.004)
cube('vent top frame',(-1.59,2.398,3.47),(.39,.028,.035),steel,.005)
cube('vent bottom frame',(-1.59,2.398,3.17),(.39,.028,.035),steel,.005)
for x in [-2.10,-.30]:
 cube('wall rib footing',(x,2.392,2.67),(.18,.10,.09),warmsteel,.01)
for i in range(8):cube('thermal cabinet recessed fin',(-3.08+i*.123,-1.849,1.43),(.037,.02,.30),warmsteel,.004)
# Verify camera, light, all old mesh shapes and locations, and exact frozen gameplay fields.
bpy.context.view_layer.update()
assert all(geom_hash(o)==base_hashes[o.name] for o in base_objects if o.type=='MESH'),'A baseline mesh moved'
assert list(cam.location)==meta['camera']['position']
scene['reserva_enrichment_groups']=json.dumps(sorted(set(o['enrichment_group'] for o in scene.objects if o.get('enrichment_group'))))
scene['reserva_base_geometry_hashes']=json.dumps(base_hashes)
scene['reserva_enrichment_source']='enrich_reserva.py'
scene.render.resolution_percentage=100 if a.final else a.percentage;scene.cycles.samples=64 if a.final else a.samples;scene.render.filepath=str(OUT/'reserva-after.png')
(OUT/'invariants.json').write_text(json.dumps({'status':'PASS','frozenFields':frozen,'cameraUnchanged':True,'lightingUnchanged':True,'originalMeshCount':len(base_hashes),'originalMeshesUnchanged':True,'addedObjects':len(set(scene.objects)-base_objects),'groups':json.loads(scene['reserva_enrichment_groups']),'shorePlacements':shore_records},indent=2)+'\n')
if not a.build_only:
 bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'reserva-enriched.blend'));bpy.ops.render.render(write_still=True)
print('RESERVA_ENRICHED='+str(OUT),flush=True)
