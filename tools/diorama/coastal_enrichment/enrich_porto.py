"""Source-grounded Porto craft study; outputs only to the supplied scratch folder.

blender -b -t 8 -P enrich_porto.py -- --repo-root REPO --output-dir OUTPUT
The published camera, playable geometry, routes, boarding and bridge stay fixed.
"""
from pathlib import Path
import bpy,math,json,random,argparse,sys,copy,runpy
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
parser=argparse.ArgumentParser();parser.add_argument('--repo-root',required=True);parser.add_argument('--output-dir',required=True);parser.add_argument('--samples',type=int,default=32);parser.add_argument('--percentage',type=int,default=50);parser.add_argument('--audit-only',action='store_true');parser.add_argument('--base-source');parser.add_argument('--baseline-meta');args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
repo=Path(args.repo_root).resolve();out=Path(args.output_dir).resolve();out.mkdir(parents=True,exist_ok=True)
source=Path(args.base_source).resolve() if args.base_source else repo/'tools/diorama/render_porto_map.py';text=source.read_text();assert '# Audit this build' in text
text=text.split('# Audit this build')[0]
text=text.replace("ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'));OUT=os.path.join(ROOT,'public/assets/world/map');DOC=os.path.join(ROOT,'docs/world/diorama')",f"ROOT={str(repo)!r};OUT={str(out)!r};DOC={str(out)!r}")
ns={'__file__':str(source),'__name__':'porto_enrichment_baseline'};exec(compile(text,str(source),'exec'),ns)
scene=bpy.context.scene;cam=scene.camera;meta=copy.deepcopy(ns['meta']);published=json.loads((Path(args.baseline_meta).resolve() if args.baseline_meta else repo/'public/assets/world/map/porto-diorama.meta.json').read_text())
for key in ['nodes','routes','secretRoute','worldRoutes','camera']:assert meta[key]==published[key],f'Baseline changed: {key}'
scene.render.resolution_percentage=args.percentage;scene.cycles.samples=args.samples
if not args.audit_only:
    scene.render.filepath=str(out/'porto-before.png');bpy.ops.render.render(write_still=True)
base_objects=set(scene.objects);group=''
def tagged(obj):obj.name='enrich_'+group+' '+obj.name;obj['enrichment_group']=group;return obj
def cube(name,loc,size,mat,bevel=.018,rot=0):return tagged(ns['cube'](name,loc,size,mat,bevel,rot))
def beam(name,a,b,r,mat,n=8):return tagged(ns['beam'](name,a,b,r,mat,n))
def cyl(name,loc,r,d,mat,n=12):return tagged(ns['cylinder'](name,loc,r,d,mat,n))
def curve(name,points,r,mat):return tagged(ns['curve'](name,points,r,mat))
def ico(name,loc,scale,mat):return tagged(ns['ico'](name,loc,scale,mat))
def torus(name,loc,r,t,mat,rotation=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=t,major_segments=24,minor_segments=6,location=loc,rotation=rotation);o=bpy.context.object;o.name=name;o.data.materials.append(mat);return tagged(o)
wood,light,dark=ns['wood'],ns['woodlight'],ns['wooddark'];wooddark=dark;steel,edge,rope=ns['steel'],ns['steelhi'],ns['rope'];cream,teal,coral=ns['cream'],ns['teal'],ns['coral']
random.seed(19031)
# Keep all walking faces exactly fixed, but break the regular every-fifth-board rhythm.
group='timber'
tones=[]
for name,color in [('honey repair',(.67,.43,.23)),('salt faded',(.77,.57,.34)),('old warm',(.60,.39,.21)),('pale edge',(.73,.53,.31))]:
    m=ns['material']('Porto '+name,color);tones.append(m)
for o in list(base_objects):
    if o.name.startswith('walk_') and 'board surface' in o.name:
        for material in tones:o.data.materials.append(material)
        for face in o.data.polygons:face.material_index=random.choices([0,1,2,3,4,5],[7,1,2,1,1,1])[0]
# Corrugated roofs and weathered corners add scale to the existing cargo, without a new route obstacle.
group='cargo_roofs'
for x,y,z,w,d,h in [(-1.1,.60,1.67,1.35,2.0,1.25),(-1.1,1.12,2.92,1.28,.85,.62),(2.45,.35,1.67,1.6,1.35,1.1),(2.45,.35,2.77,1.5,1.25,.58),(5.6,-2.5,1.67,.75,.62,.62)]:
    for i in range(8):
        xx=x-w*.42+i*w*.84/7;cube('raised cargo roof seam',(xx,y,z+h+.009),(.021,d*.86,.025),edge,.005)
    for sx in [-1,1]:
        for sy in [-1,1]:cube('cargo corner casting',(x+sx*w*.43,y+sy*d*.43,z+h+.026),(.085,.085,.065),cream,.012)
# A folded canvas cargo bundle and slatted fish crates form a compact work area behind circulation.
canvas=ns['material']('Porto faded olive tarpaulin',(.36,.47,.30));warm=ns['material']('Porto crate ochre',(.77,.53,.28))
def crate(name,x,y,z,w=.46,d=.38,h=.38):
    cube(name+' dark inset',(x,y,z+h/2),(w-.04,d-.04,h-.025),dark,.015)
    for side in [-1,1]:
        for level in range(4):cube(name+' slat',(x,y+side*d/2,z+.06+level*(h-.12)/3),(w,.037,.056),warm,.009)
        for xx in [-1,1]:cube(name+' corner',(x+xx*(w/2-.03),y+side*(d/2+.015),z+h/2),(.05,.044,h),light,.008)
    for i in range(4):cube(name+' top board',(x-w*.36+i*w*.24,y,z+h),(.09,d,.025),light,.005)
group='western_workbench'
crate('receiving crate',-3.20,1.84,1.67,.54,.48,.44);crate('stacked smaller crate',-3.22,1.85,2.12,.43,.38,.35)
crate('low rope chest',-3.12,2.33,1.67,.54,.38,.30)
for r in [.11,.15,.19]:torus('hawser coil',(-3.12,2.33,1.995),r,.019,rope)
group='eastern_cargo'
crate('east freight box',3.70,.65,1.67,.55,.48,.46)
cube('folded canvas cargo',(3.83,1.21,1.99),(.83,.65,.63),canvas,.10)
for x in [3.55,4.08]:curve('cargo binding',[(x,.88,1.69),(x,.88,2.31),(x,1.54,2.31),(x,1.54,1.69)],.022,rope)
# Hanging nets and coiled ropes stay below the walking surface, outside the front fascia.
group='fishing_nets'
for x0,x1,y in [(-2.55,-1.45,-3.17),(1.00,2.23,-3.18)]:
    for i in range(9):
        x=x0+(x1-x0)*i/8;curve('net vertical',[(x,y,1.49),(x+.04*math.sin(i),y-.045,1.0),(x+.10,y+.04,.47)],.011,rope)
    for i in range(8):
        z=.49+i/7;curve('net crossing',[(x0+.10*(1-i/7),y+.04,z),(x0+(x1-x0)*.5,y-.07,z-.07),(x1+.10*(1-i/7),y+.04,z)],.010,rope)
    for x in [x0,x1]:cyl('net hanging pin',(x,y+.02,1.54),.024,.12,edge)
# The existing buildings gain practical trim and a small side awning, not a new dominant landmark.
group='shed_trim'
for i in range(7):cube('warehouse door board',(-2.32+i*.105,1.265,2.115),(.075,.026,.77),wood,.006)
cube('warehouse eave fascia',(-2,1.205,2.83),(1.93,.075,.11),cream,.012)
cube('warehouse side sill',(-2.905,1.83,2.16),(.06,.66,.07),light,.01)
group='operations_trim'
cube('operations side window',(4.467,3.23,3.30),(.025,.50,.47),ns['glass'],.014)
for yy in [3.01,3.45]:cube('operations side frame',(4.487,yy,3.3),(.03,.025,.52),edge,.006)
cube('operations side sill',(4.51,3.23,3.045),(.13,.59,.06),cream,.01)
for i in range(4):cube('roof vent louvre',(3.66,3.233,3.95+i*.026),(.30,.02,.012),dark,.002)
# Hoist mechanics, braces and corner lamps strengthen the two original crane silhouettes.
group='crane_mechanics'
cube('gantry winch housing',(4.78,3.38,6.68),(.52,.48,.35),edge,.035)
for y in [3.12,3.64]:
    c=cyl('winch drum',(4.78,y,6.68),.16,.06,dark,20);c.rotation_euler.x=math.pi/2
for x in [2.5,3.7,4.9]:cube('gantry joint plate',(x,3.14,6.36),(.32,.035,.31),edge,.013)
for x in [1.62,5.72]:
    for z in [3.15,4.15,5.15]:beam('rear gantry cross brace',(x-.10,3.58,z),(x+.10,3.58,z+.80),.023,cream)
group='lanterns'
lamp=ns['material']('Porto warm lantern glass',(.98,.70,.29),.26)
bsdf=lamp.node_tree.nodes['Principled BSDF'];bsdf.inputs['Emission Color'].default_value=(1,.38,.08,1);bsdf.inputs['Emission Strength'].default_value=.35
for obj in base_objects:
    if obj.name.startswith('harbor lamp lantern'):obj.data.materials.clear();obj.data.materials.append(lamp)
for x,y,z in [(-2.60,1.16,2.70)]:
    cube('warm glass lantern',(x,y,z),(.16,.16,.23),lamp,.016)
    for dx in [-.078,.078]:
        for dy in [-.078,.078]:beam('lantern iron corner',(x+dx,y+dy,z-.105),(x+dx,y+dy,z+.105),.012,steel)
    cube('lantern cap',(x,y,z+.095),(.19,.19,.035),steel,.010)
# Clustered low salt scrub sits behind the quay, preserving the western ferry approach.
leaf2=ns['material']('Porto sage leaves',(.40,.56,.24));leaf3=ns['material']('Porto dry coastal leaves',(.54,.59,.28))
group='shore_scrub'
for x,y,z in [(-3.7,2.89,.61),(-2.6,2.98,.59),(-.7,3.10,.58),(3.94,4.12,.64),(5.05,4.08,.57)]:
    for i in range(5):
        a=i*math.tau/5;ico('clustered salt scrub',(x+.23*math.cos(a),y+.18*math.sin(a),z+.1*(i%2)),(.29,.21,.25),[ns['leaf'],leaf2,leaf3][i%3])
# Two barrel planters cluster the coastal greenery at existing unused rear corners.
group='barrel_planters'
for x,y,z in [(-6.03,2.10,1.65),(5.50,3.68,2.55)]:
    cyl('barrel planter',(x,y,z+.22),.225,.44,wood,16)
    for zz in [z+.06,z+.35]:torus('planter iron hoop',(x,y,zz),.225,.019,steel)
    cyl('planter soil',(x,y,z+.448),.197,.014,dark,16)
    for i in range(7):
        a=i*math.tau/7
        ico('planter leaf cluster',(x+.17*math.cos(a),y+.14*math.sin(a),z+.55+.10*(i%3)),(.18,.13,.26),[ns['leaf'],leaf2,leaf3][i%3])
# Water contact uses small broken arcs and damp pile collars, never a rectangular sea patch.
wet=ns['material']('Porto tide dark timber',(.25,.28,.19));foam=ns['material']('Porto softened water contact',(.54,.74,.70))
group='water_contact'
for x,y,r in [(-6.08,-3.68,.12),(-3.82,-3.68,.12),(-3.02,-2.83,.12),(1.20,-2.83,.12),(3.75,-2.88,.12),(6.08,-2.88,.12),(5.78,3.70,.12)]:
    cyl('damp pile collar',(x,y,.11),r+.013,.18,wet,12)
    for start,end in [(0.05,.70),(.96,1.30)]:
        curve('broken pile water ripple',[(x+(r+.11)*math.cos(a*math.pi),y+(r+.11)*math.sin(a*math.pi),.022) for a in [start+(end-start)*i/12 for i in range(13)]],.013,foam)

# Larger, legible harbour silhouettes from the concept, without changing circulation.
roof_red=ns['material']('Porto aged terracotta roof',(.67,.25,.13));roof_light=ns['material']('Porto terracotta sunlit rolls',(.77,.35,.20));roof_dark=ns['material']('Porto terracotta overlap',(.53,.19,.12))
group='office_roof'
for obj in list(scene.objects):
    if obj.name in {'operations blue roof','operations roof vent'} or 'roof vent louvre' in obj.name:bpy.data.objects.remove(obj,do_unlink=True)
x,y=3.50,3.23;left,right=x-1.14,x+1.14;front,back=y-.67,y+.67;eave,ridge=3.86,4.43
verts=[(left,front,eave),(x,front,ridge),(right,front,eave),(left,back,eave),(x,back,ridge),(right,back,eave)]
tagged(ns['mesh']('office pitched tile planes',verts,[(0,1,4,3),(1,2,5,4)],roof_red))
for yy in [2.704,3.744]:tagged(ns['mesh']('office cream gable',[(2.55,yy,3.78),(4.45,yy,3.78),(3.5,yy,4.34)],[(0,1,2)],cream))
for side in [-1,1]:
    for i in range(10):
        xx=x+side*(.035+i*.116);zz=ridge-abs(xx-x)/1.14*(ridge-eave)+.012
        beam('terracotta tile roll',(xx,front-.015,zz),(xx,back+.015,zz),.027,roof_light,10)
    for yy in [front,back]:beam('gable bargeboard',(left if side<0 else right,yy,eave-.04),(x,yy,ridge-.04),.040,cream)
    beam('roof eave fascia',(left if side<0 else right,front,eave-.04),(left if side<0 else right,back,eave-.04),.047,cream)
for yy in [front+.23,front+.51,front+.79,front+1.07]:
    for side in [-1,1]:beam('overlapping tile row',(x,yy,ridge+.015),(left if side<0 else right,yy,eave+.015),.013,roof_dark)
beam('rounded ridge cap',(x,front-.035,ridge+.025),(x,back+.035,ridge+.025),.051,roof_light,12)
oc=cyl('gable round blue window',(3.5,2.681,4.035),.115,.035,steel,24);oc.rotation_euler.x=math.pi/2
torus('gable window cream rim',(3.5,2.651,4.035),.117,.019,cream,(math.pi/2,0,0))
cube('small roof ventilator',(3.74,3.60,4.45),(.19,.22,.38),edge,.025);cube('ventilator cap',(3.74,3.60,4.65),(.29,.30,.045),cream,.015)
# An open-sided receiving workshop gives the western cargo stack a readable shelter.
group='receiving_canopy'
cloth=ns['material']('Porto workshop cream canvas',(.86,.75,.54))
canopy=[(-3.98,1.82,3.02),(-3.40,1.77,2.91),(-2.82,1.82,3.02),(-3.98,2.48,3.20),(-3.40,2.48,3.14),(-2.82,2.48,3.20)]
tagged(ns['mesh']('receiving workshop canvas',canopy,[(0,1,4,3),(1,2,5,4)],cloth))
for xx in [-3.95,-2.85]:
    beam('workshop canvas front post',(xx,1.86,1.66),(xx,1.86,3.05),.045,wooddark)
    beam('workshop roof bearer',(xx,1.86,3.03),(xx,2.40,3.20),.036,light)
curve('canvas lower hem',canopy[:3],.019,rope)
for xx in [-3.86,-3.64,-3.18,-2.96]:curve('canvas hanging scallop',[(xx-.07,1.81,3.0),(xx,1.79,2.92),(xx+.07,1.81,3.0)],.026,cloth)
crate('covered receiving box',-3.74,2.14,1.67,.35,.40,.50)
# A planted rocky rear margin is visible above the quay; no new land reaches the ferry side.
group='rear_margin'
rock_warm=ns['material']('Porto rear warm stone',(.57,.53,.43));rock_sun=ns['material']('Porto rear sandy stone',(.68,.62,.49));rock_wet=ns['material']('Porto rear wet stone',(.35,.42,.36))
for x,y,z,sx,sy,sz in [(-4.8,2.95,.62,.95,.62,.92),(-3.25,3.02,.61,.80,.64,.84),(-1.75,3.12,.67,1.02,.68,.99),(4.38,4.27,.70,.99,.63,1.10),(5.75,4.24,.69,.84,.61,1.15)]:
    ico('rear water worn footing',(x,y,.12),(sx*1.07,sy*1.07,.35),rock_wet)
    ico('rear layered rock',(x,y,z),(sx,sy,sz),rock_warm)
    ico('rear sunlit ledge',(x-.10,y-.07,z+sz*.37),(sx*.75,sy*.72,sz*.49),rock_sun)
    for i in range(6):
        a=i*math.tau/6;ico('rear clustered olive scrub',(x+.40*math.cos(a),y+.25*math.sin(a),z+sz*.76+.12*(i%2)),(.42,.31,.48),[ns['leaf'],leaf2,leaf3][i%3])
# Two wind-shaped scrub trees add a green skyline below the gantry, behind the lanes.
for x,y,z in [(-5.26,3.02,1.20),(5.79,4.25,1.44)]:
    beam('wind shaped scrub trunk',(x,y,z),(x+.09,y+.08,z+1.35),.071,wooddark)
    for side in [-1,1]:beam('scrub tree branch',(x,y,z+.85),(x+side*.34,y+.08,z+1.22),.039,wooddark)
    for dx,dy,dz in [(-.35,0,1.33),(.30,.07,1.43),(0,.12,1.67)]:ico('scrub tree foliage',(x+dx,y+dy,z+dz),(.50,.39,.49),leaf2 if dx else ns['leaf'])

# Audit additions against all original stage/secret paths plus boarding and bridge approach.
paths=[]
for kind,routes in meta['worldRoutes'].items():
    for i,route in enumerate(routes):paths.append((f'{kind}:{i}',route['world']))
dock=json.loads((repo/'public/assets/world/map/coast-port-journey.meta.json').read_text())['islands']['porto']
paths.append(('boarding',[p['world'] for p in dock.get('junctionToDock',dock.get('approach'))+dock['boardingRoute'][1:]]))
# Recover the published bridge's local world coordinates from its exact camera projection.
bridge=json.loads((repo/'public/assets/world/map/port-factory-bridge.meta.json').read_text())
def project_point(p):
    q=world_to_camera_view(scene,cam,Vector(p));return Vector((q.x,1-q.y))
zero=project_point((0,0,0));basis=[project_point(v)-zero for v in [(1,0,0),(0,1,0),(0,0,1)]];inverse=Matrix(((basis[0].x,basis[1].x),(basis[0].y,basis[1].y))).inverted()
def local_world(p,z):
    xy=inverse@(Vector((p['x'],p['y']))-zero-basis[2]*z);return [xy.x,xy.y,z]
bridge_height=meta['nodes']['2-4']['world'][2]
paths.append(('bridge-approach',[local_world(p,bridge_height) for p in bridge['islands']['porto']['junctionToLanding']]))
origin=bridge['placements']['porto']['origin'];points=bridge['bridgeRoute']['points'];landing_height=1.18
paths.append(('moving-bridge',[local_world({'x':p['x']-origin['x'],'y':p['y']-origin['y']},bridge_height if i==0 else landing_height) for i,p in enumerate(points)]))
bpy.context.view_layer.update();deps=scene.evaluated_depsgraph_get() if hasattr(scene,'evaluated_depsgraph_get') else bpy.context.evaluated_depsgraph_get()
right=cam.matrix_world.to_quaternion()@Vector((1,0,0));up=cam.matrix_world.to_quaternion()@Vector((0,1,0));forward=cam.matrix_world.to_quaternion()@Vector((0,0,-1))
issues=[];head_issues=[];samples=0
for name,path in paths:
    for si,(aa,bb) in enumerate(zip(path,path[1:])):
        a,b=Vector(aa),Vector(bb);d=b-a;side=Vector((-d.y,d.x,0)).normalized();steps=max(2,math.ceil(d.length/.08))
        for i in range(steps+1):
            foot=a.lerp(b,i/steps)
            for lateral in [-.28,0,.28]:
                q=foot+side*lateral;hit,loc,n,face,obj,m=scene.ray_cast(deps,q+Vector((0,0,.98)),Vector((0,0,-1)),distance=1.0)
                if hit and obj.get('enrichment_group') and loc.z>foot.z+.17:head_issues.append({'route':name,'segment':si,'t':i/steps,'object':obj.name})
            for frac in [.1,.22,.42,.67,.9,.98]:
                for lateral in [-.95,-.5,0,.5,.95]:
                    target=foot+up*(78/384*4.15)*frac+right*(48/384*4.15/2)*lateral;samples+=1
                    hit,loc,n,face,obj,m=scene.ray_cast(deps,target-forward*60,forward,distance=59.96)
                    if hit and obj.get('enrichment_group'):issues.append({'route':name,'segment':si,'t':round(i/steps,4),'heightFraction':frac,'object':obj.name,'group':obj['enrichment_group']})
report={'baselineFrozenFieldsPreserved':True,'projectedSamples':samples,'newProjectedContacts':issues,'newHeadroomContacts':head_issues,'addedObjects':len(set(scene.objects)-base_objects),'groups':sorted(set(o['enrichment_group'] for o in scene.objects if o.get('enrichment_group'))),'camera':meta['camera'],'note':'Original walking meshes and frame/camera remain fixed. Added-object camera rays include lower-body contact; no pre-existing contact is reclassified as new. Connector audit also covers the original boarding and fixed bridge approach.'}
checked=runpy.run_path(str(repo/'tools/diorama/check_porto_clearance.py'),init_globals={'PORTO_META':copy.deepcopy(published),'PORTO_OUT':str(out/'canonical-audit'),'PORTO_DOC':str(out/'canonical-audit')},run_name='__main__')
meta=checked['meta'];meta['status']='enrichment-candidate-for-review';meta['enrichmentAuditSummary']={'projectedSamples':samples,'newProjectedContactCount':len(issues),'newHeadroomContactCount':len(head_issues)}
(out/'porto-enrichment-audit.json').write_text(json.dumps(report,indent=2)+'\n');(out/'porto-enrichment.meta.json').write_text(json.dumps(meta,indent=2)+'\n')
print('PORTO_ENRICHMENT_AUDIT='+json.dumps({k:v for k,v in report.items() if k not in ['newProjectedContacts','newHeadroomContacts']}));print('NEW_PROJECTED_CONTACTS='+json.dumps(issues));print('NEW_HEADROOM_CONTACTS='+json.dumps(head_issues))
if not args.audit_only:
    scene.render.filepath=str(out/'porto-after.png');bpy.ops.render.render(write_still=True);bpy.ops.wm.save_as_mainfile(filepath=str(out/'porto-enriched.blend'))
