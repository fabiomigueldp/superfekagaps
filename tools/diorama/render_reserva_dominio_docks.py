"""Additive Reserva→Domínio dock geometry and same-camera cropped overlays.

blender -b -t 8 -P tools/diorama/render_reserva_dominio_docks.py -- --output-dir DIR --proof
Frozen island builders are reused without running their render/publication tails.
All .blend and proof images remain in scratch; packaging is an explicit later step.
"""
from pathlib import Path
import argparse, hashlib, json, math, re, runpy, subprocess, sys
import bpy
from mathutils import Matrix, Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser()
p.add_argument('--output-dir', type=Path, default=Path('/tmp/feka-reserva-dominio-docks'))
p.add_argument('--proof', action='store_true');p.add_argument('--render-overlays', action='store_true')
p.add_argument('--samples', type=int, default=12)
args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
OUT=args.output_dir;OUT.mkdir(parents=True,exist_ok=True)
PLACEMENTS={'reserva':{'origin':{'x':2.7,'y':-1.8},'scale':1},'dominio':{'origin':{'x':1.5,'y':-1.8},'scale':1}}

def build_source(name):
    argv=sys.argv[:];sys.argv=[argv[0],'--','--build-only','--output-dir',str(OUT/(name+'-source'))]
    runpy.run_path(str(ROOT/'tools/diorama'/('render_'+name+'_map.py')),run_name=name+'_source')
    sys.argv=argv
    scene=bpy.context.scene;meta=json.loads(scene[name+'_metadata'])
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(name+'-source.blend')))
    return meta

# Both sources share exactly the frozen camera, allowing a ground-plane transform.
dominio=build_source('dominio');reserva=build_source('reserva')
scene=bpy.context.scene;cam=scene.camera
assert reserva['camera']==dominio['camera']
assert reserva['nodes']==json.loads((ROOT/'public/assets/world/map/reserva-diorama.meta.json').read_text())['nodes']
base_reserva=list(scene.objects)
for o in base_reserva:o['island']='reserva'

def project(p,local=None):
    q=world_to_camera_view(scene,cam,Vector(p));v=Vector((q.x,1-q.y))+Vector((2.7,-1.8))
    if local:v-=Vector(tuple(PLACEMENTS[local]['origin'].values()))
    return {'x':round(v.x,8),'y':round(v.y,8)}

origin=Vector(tuple(project((0,0,0)).values()))
basis=[Vector(tuple(project(v).values()))-origin for v in [(1,0,0),(0,1,0),(0,0,1)]]
xy=Matrix(((basis[0].x,basis[1].x),(basis[0].y,basis[1].y))).inverted()
shift=xy@Vector((-1.2,0));transform=Matrix.Translation((shift.x,shift.y,0))
with bpy.data.libraries.load(str(OUT/'dominio-source.blend'),link=False) as (available,loaded):loaded.objects=available.objects
base_dominio=[]
for o in loaded.objects:
    if o and o.type in {'MESH','CURVE','FONT'}:
        o.name='dominio '+o.name;scene.collection.objects.link(o);o['island']='dominio';base_dominio.append(o)
bpy.context.view_layer.update()
for o in base_dominio:o.matrix_world=transform@o.matrix_world.copy()
bpy.context.view_layer.update()
BASE=[o for o in scene.objects if o.type in {'MESH','CURVE','FONT'}]
original={o.name:[list(row) for row in o.matrix_world] for o in BASE}
GROUPS={'reserva':[],'dominio':[],'reserva-gate':[],'dominio-gate':[]}
SUPPORT={'reserva':[],'dominio':[]}

def world(p,island):return transform@Vector(p) if island=='dominio' else Vector(p)
def material(name,rgb,metal=0):
    color=tuple(((v+.055)/1.055)**2.4 if v>.04045 else v/12.92 for v in rgb)
    m=bpy.data.materials.new('ferry '+name);m.diffuse_color=(*color,1);m.use_nodes=True
    s=m.node_tree.nodes['Principled BSDF'];s.inputs['Base Color'].default_value=(*color,1);s.inputs['Roughness'].default_value=.60;s.inputs['Metallic'].default_value=metal
    return m
ice=material('dry heated deck',(.75,.83,.83),.1);wood=material('warm dock timber',(.68,.46,.26));cream=material('garden cream stone',(.88,.82,.65))
steel=material('dark maritime steel',(.17,.29,.32),.3);copper=material('warm copper heating',(.83,.49,.23),.45);stone=material('rooted seawall rock',(.40,.44,.45));red=material('closed dock stripe',(.79,.29,.14))

def finish(o,name,mat,group):
    o.name='ferry '+name;o.data.materials.append(mat);o['dock_group']=group;GROUPS[group].append(o);return o

def mesh(name,vs,faces,mat,group):
    data=bpy.data.meshes.new(name);data.from_pydata([tuple(v) for v in vs],[],faces);data.update();o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);return finish(o,name,mat,group)

def cube(name,p,size,mat,group):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    finish(o,name,mat,group);mod=o.modifiers.new('worked corners','BEVEL');mod.width=.012;mod.segments=2;o.modifiers.new('weighted normals','WEIGHTED_NORMAL');return o

def beam(name,a,b,r,mat,group):
    a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=r,depth=(b-a).length,location=(a+b)/2);o=bpy.context.object;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return finish(o,name,mat,group)

def walkway(name,points,width,island,mat=None,piles=True):
    pts=[world(v,island) for v in points];sides=[Vector((-(b-a).y,(b-a).x,0)).normalized() for a,b in zip(pts,pts[1:])]
    top=[]
    for i,p in enumerate(pts):
        side=sides[0] if i==0 else sides[-1] if i==len(pts)-1 else (sides[i-1]+sides[i]).normalized()
        extent=width/2/max(.5,side.dot(sides[min(i,len(sides)-1)]));top += [p-side*extent-Vector((0,0,.025)),p+side*extent-Vector((0,0,.025))]
    n=len(top);verts=top+[p-Vector((0,0,.15)) for p in top]+[p-Vector((0,0,.025)) for p in pts];faces=[]
    for i,(a,b) in enumerate(zip(pts,pts[1:])):
        j=i*2;faces.extend([(j,j+2,2*n+i+1),(j,2*n+i+1,2*n+i),(2*n+i,2*n+i+1,j+3),(2*n+i,j+3,j+1),(n+j,n+j+1,n+j+3,n+j+2),(j,n+j,n+j+2,j+2),(j+1,j+3,n+j+3,n+j+1)])
        SUPPORT[island].append([project(top[k],island) for k in [j,j+2,j+3,j+1]])
        side=sides[i]
        for s in [-1,1]:
            off=side*s*(width/2-.11)
            beam(name+' bearer',a+off-Vector((0,0,.21)),b+off-Vector((0,0,.21)),.06,steel,island)
            if piles:
                for k in range(max(1,math.ceil((b-a).length/1.5))+1):
                    q=a.lerp(b,k/max(1,math.ceil((b-a).length/1.5)))+off
                    # Piles descend below the sea plane into authored masonry shoes.
                    beam(name+' rooted pile',(q.x,q.y,-.24),(q.x,q.y,q.z-.15),.055,steel,island)
                    cube(name+' seabed footing',(q.x,q.y,-.18),(.25,.25,.24),stone,island)
        for k in range(max(1,int((b-a).length/.30))):
            q=a.lerp(b,(k+.5)/max(1,int((b-a).length/.30)))-Vector((0,0,.02))
            
            if abs(b.z-a.z)<.05 and 'copper quay' not in name:beam(name+' narrow plank seam',q-side*(width/2-.02),q+side*(width/2-.02),.004,steel,island)
    faces += [(0,1,n+1,n),(n-2,2*n-2,2*n-1,n-1)]
    o=mesh('walk '+name,verts,faces,mat or (ice if island=='reserva' else wood),island);o['walk_support']=True;return o

APPROACH={'reserva':[[-3.8,.6,2.7],[-4.5,1.25,2.7],[-5.65,1.25,2.7],[-6.5,2.1,2.7],[-7.4,2.1,2.7],[-7.4,-2.5,.65],[-8.25,-2.5,.65]],
          'dominio':[[5.3,-2.4,1.35],[6.35,-2.4,1.35],[7.4,-2.4,.90],[8.1,-2.4,.65]]}
FEET={'reserva':[-9.4,-2.5,.60],'dominio':[9.2,-2.4,.60]}
BOARD={'reserva':[APPROACH['reserva'][-1],[-8.78,-2.5,.625],FEET['reserva']],
       'dominio':[APPROACH['dominio'][-1],[8.58,-2.4,.625],FEET['dominio']]}
# Supported1.05-wide turns are joined miter solids. A little overlap at the frozen
# attachment seam prevents a paper-thin gap while leaving old art untouched.
walkway('Reserva copper quay',APPROACH['reserva'][3:],1.05,'reserva')
walkway('Reserva attachment seam apron',[(-6.78,2.1,2.692),(-6.22,2.1,2.692)],.56,'reserva')
walkway('Domínio garden landing',APPROACH['dominio'][1:],1.05,'dominio',cream)
# Fixed gangways stop at the side of the vessel: its real deck supports the final
# boarding steps. This prevents a permanent plank through the departing hull.
for island in ['reserva','dominio']:
    walkway(island+' short side gangway',BOARD[island][:2],.44,island,wood,piles=False)
    # A square landing extends around the dock stop, without intruding on the hull.
    q=Vector(APPROACH[island][-1])-Vector((0,0,.008));walkway(island+' dock apron',[q-Vector((0,.56,0)),q+Vector((0,.56,0))],.64,island,wood)
for island,x in [('reserva',-8.82),('dominio',8.62)]:
    q=world((x,FEET[island][1],.599),island)
    lip=cube(island+' thin boarding lip',q,(.10,.44,.006),copper if island=='reserva' else steel,island)
    lip.modifiers.clear();lip['walk_support']=True
# The authored footing extends below sea level; the actual water surface masks
# submerged geometry without baking a rectangular water patch into the overlay.
bpy.ops.mesh.primitive_plane_add(size=120,location=(0,0,.03));WATER=bpy.context.object;WATER.name='ferry sea waterline depth holdout';WATER.is_holdout=True;WATER['water_holdout']=True
# Copper loop sits on the FAR side of the descent below Feka's upper-body pixels.
for a,b in zip(APPROACH['reserva'][3:5],APPROACH['reserva'][4:6]):
    aa=Vector(a)+Vector((-.40,0,-.10));bb=Vector(b)+Vector((-.40,0,-.10));beam('exposed heating pipe',aa,bb,.038,copper,'reserva')
# Restrained garden masonry shoe at the existing landing seam.
q=world((6.55,-2.4,.67),'dominio');cube('garden landing abutment',q,(.38,1.0,1.18),cream,'dominio')
# Closed gates are separate overlays. Open state removes the gate entirely; its
# hinge socket stays outside the1.05-wide route and does not block a walking foot.
GATES={}
for island,local in [('reserva',(-6.92,2.1,2.7)),('dominio',(6.78,-2.4,1.1657))]:
    q=world(local,island);group=island+'-gate';side=Vector((0,1,0));pivot=q+side*.67
    cube(island+' gate hinge',pivot+Vector((0,0,.12)),(.13,.13,.35),steel,island)
    beam(island+' closed crossbar',q-side*.57+Vector((0,0,.45)),q+side*.57+Vector((0,0,.45)),.045,red,group)
    for s in [-1,1]:beam(island+' gate upright',q+side*s*.55,q+side*s*.55+Vector((0,0,.66)),.035,copper if island=='reserva' else steel,group)
    GATES[island]={'world':list(local),'position':project(q,island),'state':'separate-closed-layer; removed completely while open'}
# Build the SAME original boat meshes, omitting only its camera/export loop.
boat_source=ROOT/'tools/diorama/render_journey_boat.py';source=boat_source.read_text();ns={'bpy':bpy,'math':math,'Vector':Vector,'Matrix':Matrix}
exec(compile(source[source.index('def mat('):source.index('scene=bpy.context.scene')],str(boat_source),'exec'),ns)
BOAT=ns['objects'];boat_original={o.name:o.matrix_world.copy() for o in BOAT}
for o in BOAT:o['ferry_boat']=True;o.hide_render=True

def boat_pose(foot,heading):
    rot=Matrix.Rotation(heading*math.tau/8,4,'Z');shift=Vector(foot)-rot@Vector((.22,0,.60));matrix=Matrix.Translation(shift)@rot
    for o in BOAT:o.matrix_world=matrix@boat_original[o.name]
    bpy.context.view_layer.update()

feet={k:world(v,k) for k,v in FEET.items()}
# Depart laterally from each fixed gangway before changing heading; middle leg
# remains in the clear inter-island sea. Reverse turn occurs at detached knots.
SAIL=[feet['reserva'],feet['reserva']+Vector((-2.70,0,0)),feet['dominio']+Vector((2.70,0,0)),feet['dominio']]
length=lambda pts:sum((Vector(b)-Vector(a)).length for a,b in zip(pts,pts[1:]))
meta={'version':1,'connection':{'id':'reserva-dominio','from':'5-5','to':'6-1','completionId':'5-5','mode':'ferry'},
      'coordinateSystem':'Island-local normalized1920x1200; atlas adds fixed placement; common world XYZ is Reserva frame.',
      'placements':PLACEMENTS,'camera':reserva['camera'],'size':reserva['size'],
      'boatAsset':'/assets/world/map/journey-boat.meta.json','dockInstances':{},
      'sailRoute':{'points':[project(p) for p in SAIL],'world':[list(p) for p in SAIL],
                   'segmentHeadings':[6,6,6],'reverseSegmentHeadings':[6,2,6],
                   'durationSeconds':round(length(SAIL)/3.2,6),'speedWorldUnitsPerSecond':3.2},
      'geometry':{'dominioToReservaWorld':[list(row) for row in transform],
                  'approaches':{k:[list(world(p,k)) for p in v] for k,v in APPROACH.items()},
                  'boardingRoutes':{k:[list(world(p,k)) for p in v] for k,v in BOARD.items()},
                  'feet':{k:list(v) for k,v in feet.items()},'boatLocalFoot':[.22,0,.60],
                  'fixedGangwayEndpoint':{k:BOARD[k][1] for k in BOARD}},
      'sources':{str(path.relative_to(ROOT)):hashlib.sha256(path.read_bytes()).hexdigest() for path in [Path(__file__),ROOT/'tools/diorama/render_reserva_map.py',ROOT/'tools/diorama/render_dominio_map.py',boat_source]},
      'preservation':{'reservaNodesAndCameraUnchanged':True,'baseObjectTransformsUnchanged':all(max(abs(o.matrix_world[r][c]-original[o.name][r][c]) for r in range(4) for c in range(4))<1e-5 for o in BASE)},
      'overlays':[]}
for island in ['reserva','dominio']:
    foot=Vector(FEET[island]);water=foot+Vector((0,.22,-.57))
    meta['dockInstances'][island]={'stage':'5-5' if island=='reserva' else '6-1',
       'approach':[{**project(world(p,island),island),'world':p} for p in APPROACH[island]],
       'dock':{**project(world(APPROACH[island][-1],island),island),'world':APPROACH[island][-1]},
       'boardingRoute':[{**project(world(p,island),island),'world':p} for p in BOARD[island]],
       'berth':{'headingFrame':6,'passengerWorld':list(foot),'waterlineWorld':list(water),
                'passenger':project(world(foot,island),island),'waterline':project(world(water,island),island)},
       'approachDurationSeconds':round(length(APPROACH[island])/1.73,6),'boardingDurationSeconds':round(length(BOARD[island])/1.73,6),
       'supports':SUPPORT[island],'gate':GATES[island]}
# Compact support ribbons are backed by the exact seven-point grounded footprint
# audit. The boat deck closes the final half-meter; no image rectangle grants
# walk permission. Frozen route prefixes retain their existing support widths.
for island in ['reserva','dominio']:
    polys=[]
    for route,width in [(APPROACH[island],.80),(BOARD[island],.36)]:
        pts=[world(v,island) for v in route]
        for a,b in zip(pts,pts[1:]):
            side=Vector((-(b-a).y,(b-a).x,0)).normalized()*width/2
            along=Vector((b.x-a.x,b.y-a.y,0)).normalized()*.035
            polys.append([project(v,island) for v in [a-side-along,b-side+along,b+side+along,a+side-along]])
    pts=[q for poly in polys for q in poly]
    bounds={'left':min(q['x'] for q in pts),'top':min(q['y'] for q in pts),'right':max(q['x'] for q in pts),'bottom':max(q['y'] for q in pts)}
    meta['dockInstances'][island]['support']={'bounds':bounds,'polygons':polys}
    meta['dockInstances'][island]['approachBounds']=bounds.copy()
    # The gate lies on the actual hull ring at source-longitudinal x=.22.
    # Runtime interpolation uses x*1.6/y, so threshold is measured in that metric.
    gate_side=.59+(.22+1.25)/(.66+1.25)*.02
    threshold=Vector(FEET[island])+Vector((gate_side if island=='reserva' else -gate_side,0,0))
    fraction=abs(threshold.x-BOARD[island][1][0])/abs(FEET[island][0]-BOARD[island][1][0])
    threshold.z=BOARD[island][1][2]+fraction*(FEET[island][2]-BOARD[island][1][2])
    projected=[Vector(tuple(project(world(p,island),island).values())) for p in BOARD[island]]
    gate=Vector(tuple(project(world(threshold,island),island).values()))
    metric=lambda a,b: math.hypot((b.x-a.x)*1.6,b.y-a.y)
    meta['dockInstances'][island]['aboardProgress']=round((metric(projected[0],projected[1])+metric(projected[1],gate))/sum(metric(a,b) for a,b in zip(projected,projected[1:])),9)
    meta['dockInstances'][island]['boardingThresholdWorld']=list(threshold)
# Store boat canonical matrices for the focused checker, which tests every heading.
scene['reserva_dominio_boat_originals']=json.dumps({k:[list(row) for row in m] for k,m in boat_original.items()})
scene['reserva_dominio_metadata']=json.dumps(meta)
for group in ['reserva-gate','dominio-gate']:
    for o in GROUPS[group]:o.hide_render=True
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'reserva-dominio-docks.blend'))

# Exact native-resolution bounds with a small transparent guard band. Frozen
# islands are alpha holdouts from the first export, so sockets stay buried.
original_loc=cam.location.copy();original_scale=cam.data.ortho_scale

def set_crop(bounds):
    left,top,right,bottom=bounds;width,height=right-left,bottom-top
    cam.location=original_loc+cam.rotation_euler.to_matrix()@Vector((((left+width/2)-.5)*20.6,-((top+height/2)-.5)*12.875,0))
    cam.data.ortho_scale=max(20.6*width,12.875*height);scene.render.resolution_x=round(width*1920);scene.render.resolution_y=round(height*1200);scene.render.resolution_percentage=100

for group,objects in GROUPS.items():
    points=[project(o.matrix_world@Vector(corner),'reserva') for o in objects for corner in o.bound_box]
    left=math.floor(min(q['x'] for q in points)*1920-8)/1920;right=math.ceil(max(q['x'] for q in points)*1920+8)/1920
    top=math.floor(min(q['y'] for q in points)*1200-8)/1200;bottom=math.ceil(max(q['y'] for q in points)*1200+8)/1200
    record={'id':group,'island':group.split('-')[0],'path':'/assets/world/map/reserva-dominio-'+group+'.webp',
            'left':round(2.7+left,9),'top':round(-1.8+top,9),'width':round((right-left)*1920),'height':round((bottom-top)*1200),
            'widthInMap':round(right-left,9),'heightInMap':round(bottom-top,9),'state':'closed' if 'gate' in group else 'always'}
    meta['overlays'].append(record)
    if args.render_overlays:
        for o in BASE:o.is_holdout=True;o.hide_render=False
        for other,items in GROUPS.items():
            for o in items:o.hide_render=other!=group;o.is_holdout=False
        # Static dock geometry also masks closed gates at their actual depth.
        if 'gate' in group:
            for o in GROUPS[group.split('-')[0]]:o.hide_render=False;o.is_holdout=True
        set_crop((left,top,right,bottom));scene.cycles.samples=args.samples;scene.render.filepath=str(OUT/(Path(record['path']).stem+'.png'));bpy.ops.render.render(write_still=True)
    cam.location=original_loc;cam.data.ortho_scale=original_scale;scene.render.resolution_x=1920;scene.render.resolution_y=1200;bpy.context.view_layer.update()
for o in BASE:o.is_holdout=False;o.hide_render=False
for group,objects in GROUPS.items():
    for o in objects:o.is_holdout=False;o.hide_render='gate' in group
scene['reserva_dominio_metadata']=json.dumps(meta)
(OUT/'reserva-dominio-docks.meta.json').write_text(json.dumps(meta,indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'reserva-dominio-docks.blend'))

if args.proof:
    # Proof uses the source-authored Feka pixels in the common depth scene.
    sprite=json.loads(subprocess.check_output(['node',str(ROOT/'tools/diorama/export_serra_sprite.mjs')],text=True));pixel=sprite['pixelMapWidth']*20.6
    colors=dict(re.findall(r"(\w+):\s*'(#[0-9a-fA-F]{6})'",(ROOT/'src/graphics/palette.ts').read_text()));mapping=dict(re.findall(r'(\w): ART\.(\w+)',(ROOT/'src/assets/playerSpriteSpec.ts').read_text()));mats={}
    for sym,key in mapping.items():
        h=colors[key].lstrip('#');m=material('proof Feka '+sym,tuple(int(h[i:i+2],16)/255 for i in (0,2,4)));m.node_tree.nodes.clear();em=m.node_tree.nodes.new('ShaderNodeEmission');em.inputs[0].default_value=m.diffuse_color;out=m.node_tree.nodes.new('ShaderNodeOutputMaterial');m.node_tree.links.new(em.outputs[0],out.inputs['Surface']);mats[sym]=m
    basis=cam.rotation_euler.to_matrix();right=basis@Vector((1,0,0));up=basis@Vector((0,1,0));toward=basis@Vector((0,0,1))
    proof=[]
    for island in ['reserva','dominio']:
        for index,foot in enumerate([world(APPROACH[island][-3],island),world(APPROACH[island][-1],island),feet[island]]):
            vertices={k:[] for k in mats};faces={k:[] for k in mats}
            for y,row in enumerate(sprite['frames']['idle']):
                for x,sym in enumerate(row):
                    if sym=='_':continue
                    a=foot+toward*.008+right*((x-8)*pixel)+Vector((0,0,(25-y)*pixel/up.z));n=len(vertices[sym]);vertices[sym]+=[a,a+right*pixel,a+right*pixel+Vector((0,0,pixel/up.z)),a+Vector((0,0,pixel/up.z))];faces[sym].append((n,n+1,n+2,n+3))
            for sym in mats:
                if vertices[sym]:
                    o=mesh('proof Feka '+island+str(index),vertices[sym],faces[sym],mats[sym],island);o['proof_actor']=True;o.visible_shadow=False;proof.append(o)
    # Both original boats are shown at the fixed berths in this one proof.
    boat_pose(feet['reserva'],6)
    for o in BOAT:o.hide_render=False
    copies=[]
    boat_pose(feet['dominio'],6)
    for o in BOAT:
        c=o.copy();c.data=o.data.copy();scene.collection.objects.link(c);copies.append(c)
    boat_pose(feet['reserva'],6)
    set_crop((-.82,.13,.28,1.00));scene.cycles.samples=args.samples;scene.render.filepath=str(OUT/'combined-dock-proof.png');bpy.ops.render.render(write_still=True)
    # Native-detail crops retain exact actor scale for geometry inspection.
    for island,bounds in [('reserva',(-.08,.16,.30,.66)),('dominio',(-.57,.68,-.26,1.02))]:
        set_crop(bounds);scene.render.filepath=str(OUT/(island+'-dock-proof.png'));bpy.ops.render.render(write_still=True)
print('RESERVA_DOMINIO_DOCKS='+str(OUT),flush=True)
