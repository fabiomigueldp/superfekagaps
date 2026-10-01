"""Portable authored Serra Suspensa scene. Blender4.x, original geometry, no Boolean cuts.
Use --build-only to leave scene/meta in memory without exporting or rendering.
Use --output-dir DIR --final --static for full-size background without moving carriers.
"""
import bpy, math, os, json, random, sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'));REPO=ROOT
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
OUT=str(globals().get('FEKA_SERRA_OUT') or (ARGS[ARGS.index('--output-dir')+1] if '--output-dir' in ARGS else '/tmp/feka-serra-build'))
BUILD_ONLY=bool(globals().get('FEKA_SERRA_BUILD_ONLY',False)) or '--build-only' in ARGS
os.makedirs(OUT,exist_ok=True)
random.seed(4012026); FINAL='--final' in sys.argv
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(n,c,rough=.65,metal=0):
 c=tuple(((v+.055)/1.055)**2.4 if v>.04045 else v/12.92 for v in c);m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
stone=mat('Pale silver limestone',(.67,.69,.73)); light=mat('Warm limestone faces',(.82,.80,.72)); shadow=mat('Lilac shale strata',(.45,.48,.58)); grass=mat('Mountain moss',(.43,.56,.28)); pathmat=mat('Warm limestone trail',(.90,.85,.69)); pine=mat('Pine needles',(.13,.32,.28)); pinehi=mat('Pine sunlit tips',(.24,.43,.30)); wood=mat('Warm mountain timber',(.48,.29,.17)); timber=mat('Cut bridge planks',(.69,.48,.28)); cream=mat('Warm station plaster',(.92,.82,.60)); red=mat('Terracotta station roofs',(.74,.29,.20)); redhi=mat('Terracotta ridge caps',(.89,.43,.28)); steel=mat('Cable blue steel',(.19,.33,.41),.43,.3); dark=mat('Cable graphite',(.12,.19,.25),.45,.5); gold=mat('Cable wheel brass',(.92,.64,.18),.38,.45); glass=mat('Blue cabin glass',(.33,.64,.72),.25,.15); glow=mat('Warm lamps',(.99,.75,.32)); violet=mat('Maintenance lilac pennant',(.65,.47,.77)); white=mat('Cabin ivory markings',(.98,.92,.72))
def assign(o,m):o.data.materials.append(m);return o
def bevel(o,r=.03):
 b=o.modifiers.new('Crafted edges','BEVEL');b.width=r;b.segments=2;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return o
def cube(n,loc,dims,m,r=.025):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=n;o.dimensions=dims;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);assign(o,m)
 if r:bevel(o,r)
 return o
def cyl(n,loc,r,depth,m,verts=20):
 bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=loc);o=bpy.context.object;o.name=n;assign(o,m);bevel(o,.012);return o
def beam(n,a,b,r,m):
 a,b=Vector(a),Vector(b);o=cyl(n,(a+b)/2,r,(b-a).length,m,12);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def mesh(n,verts,faces,m):
 me=bpy.data.meshes.new(n);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);assign(o,m);return o
def curve(n,points,r,m):
 c=bpy.data.curves.new(n,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=2;s=c.splines.new('POLY');s.points.add(len(points)-1)
 for p,co in zip(s.points,points):p.co=(*co,1)
 o=bpy.data.objects.new(n,c);bpy.context.collection.objects.link(o);assign(o,m);return o
# Authored geological sections, full closed polygonal solids, never Boolean cuts.
def rock(n,x,y,rx,ry,z,h,seed=0):
 rng=random.Random(401+seed); count=9; rings=[]; angles=[2*math.pi*i/count+rng.uniform(-.10,.10) for i in range(count)]; jitter=[rng.uniform(.76,1.14) for i in range(count)]
 for dz,sc,shift in [(0,1.16,(-.12,.04)),(h*.27,1.06,(.15,-.12)),(h*.62,.89,(-.17,.10)),(h,.73,(0,0))]:
  rings += [(x+math.cos(a)*rx*j*sc+shift[0],y+math.sin(a)*ry*j*sc+shift[1],z+dz) for a,j in zip(angles,jitter)]
 fs=[tuple(range(count-1,-1,-1)),tuple(range(count*3,count*4))]
 for row in range(3):
  for i in range(count):fs.append((row*count+i,row*count+(i+1)%count,(row+1)*count+(i+1)%count,(row+1)*count+i))
 o=mesh(n,rings,fs,stone);o.data.materials.append(light);o.data.materials.append(shadow)
 for f in o.data.polygons:f.material_index=(1 if f.normal.y<-.15 else 2 if f.normal.x>.35 else 0) if f.index>1 else 1
 bevel(o,.035)
 if n!='continuous mountain foot':
  for row in [1,2]:
   ring=rings[row*count:(row+1)*count];curve(n+' fine sediment seam',ring+[ring[0]],.009,shadow)
  for side_index in [5,6,7]:
   lo=Vector(rings[side_index]);hi=Vector(rings[3*count+side_index]);pts=[lo.lerp(hi,t)+Vector((.025*math.sin(j*2.2),-.016,0)) for j,t in enumerate([.15,.31,.47,.63,.79])];curve(n+' vertical rock fissure',pts,.010,shadow)
 # Moss is on the top of a real rock, kept behind walk surfaces.
 verts=[(vx,vy,z+h+.02) for vx,vy,_ in rings[-count:]]
 if n!='continuous mountain foot':mesh(n+' moss crown',verts,[tuple(range(count))],grass)
 return o
# Low continuous reef joins the group; tall front clefts keep the silhouette mountainous.
rock('continuous mountain foot',0,.5,6.4,4.45,-.20,.76,22)
rock('western approach crag',-4.85,-1.6,1.8,2.45,.2,1.20,1)
rock('western station escarpment',-4.4,.55,2.0,1.55,.3,2.35,2)
rock('crossing station buttress',-.8,.1,1.55,2.3,.25,3.20,4)
rock('high crossing eastern crag',4,-.9,1.8,1.6,.25,3.55,5)
rock('upper station escarpment',3.65,2.15,2.15,1.45,.3,4.90,6)
rock('western needle summit',-3.65,2.75,.87,1.05,.3,5.0,7)
rock('central split needle',-.95,4.1,.78,.86,.3,5.8,8)
# Rear cabin corridor replaces this decorative low needle.
rock('eastern needle summit',5.5,2.9,.73,.86,.3,5.1,10)
# Broken summit crowns are hand-authored tapered wedges, not flat cylindrical towers.
def summit(n,x,y,z,rx,ry,h):
 vs=[(x-rx,y-ry*.60,z),(x+rx*.8,y-ry,z+.1),(x+rx,y+ry*.65,z),(x-rx*.8,y+ry,z),(x-rx*.28,y+ry*.1,z+h),(x+rx*.24,y-ry*.18,z+h*.79)]
 o=mesh(n,vs,[(0,1,5,4),(1,2,5),(2,3,4,5),(3,0,4),(0,3,2,1)],stone);o.data.materials.append(light);o.data.materials.append(shadow)
 for f in o.data.polygons:f.material_index=1 if f.index==0 else 2 if f.index==1 else 0
 bevel(o,.025)
summit('western angular peak',-3.65,2.75,5.27,.70,.75,1.02)
summit('central angular peak',-.95,4.1,6.07,.68,.68,1.35)
summit('eastern angular peak',5.5,2.9,5.38,.56,.67,1.1)
# Slim vertical ledges are faceted real pieces attached to the cliff, not loose scenery.
for i,(x,y,rx,ry,h) in enumerate([(-6,-.8,.42,.65,1.6),(-5,2.2,.45,.65,3.0),(-2,1.85,.38,.46,3.25),(-.1,-.2,.35,.52,2.5),(2.75,3.5,.5,.55,4.1),(5.65,-.65,.45,.6,3.0),(4.7,3.6,.48,.50,4.7)]):rock('cleaved outer limestone '+str(i),x,y,rx,ry,.1,h,30+i)
NODES={'4-1':(-5.75,-3.60,1.65),'4-2':(-4.65,-.15,2.95),'4-3':(-.85,-1.70,3.75),'4-4':(3.75,-2.10,4.15),'4-5':(3.55,1.18,5.45)}
MAIN=[[NODES['4-1'],(-5.75,-2.65,1.65),(-5.75,-1.05,2.95),(-5.75,-.15,2.95),NODES['4-2']],[NODES['4-2'],(-4.05,-.15,2.95),(-3.55,-.47,2.95),(-2.05,-1.43,3.75),(-1.6,-1.70,3.75),NODES['4-3']],[NODES['4-3'],(.3,-1.70,3.75),(2.55,-2.10,4.15),NODES['4-4']],[NODES['4-4'],(5.20,-2.10,4.15),(5.20,-1.45,4.15),(5.20,.25,5.45),(5.20,1.18,5.45),NODES['4-5']]]
# Two fixed lanes / two berths at each station. Phase chooses which car waits on which lane.
BASE_A=Vector((.35,.06,3.75));BASE_B=Vector((2.10,1.46,5.45));line=BASE_B-BASE_A;perp=Vector((-line.y,line.x,0)).normalized()
LANE_DISTANCE=3.4
FRONT_A=BASE_A-perp*.90;FRONT_B=BASE_B-perp*.90
BERTHS_A=[tuple(FRONT_A+perp*LANE_DISTANCE),tuple(FRONT_A)];BERTHS_B=[tuple(FRONT_B+perp*LANE_DISTANCE),tuple(FRONT_B)]
PAIR_A=(Vector(BERTHS_A[0])+Vector(BERTHS_A[1]))/2;PAIR_B=(Vector(BERTHS_B[0])+Vector(BERTHS_B[1]))/2
BOARD=tuple(PAIR_A);ARRIVE=tuple(PAIR_B)
SECRET_APPROACH=[NODES['4-3'],(-1.20,-1.0,3.75)]
SECRET_ARRIVAL=[(3.51,1.46,5.45),NODES['4-5']]
STAGING_A=[(p[0]-.95,p[1],p[2]) for p in BERTHS_A];STAGING_B=[(p[0]+.95,p[1],p[2]) for p in BERTHS_B]
WALK_TO_A=[[SECRET_APPROACH[-1],(STAGING_A[0][0]-.15,STAGING_A[0][1]-.90,3.75),STAGING_A[0]],[SECRET_APPROACH[-1],STAGING_A[1]]]
WALK_TO_B=[[SECRET_ARRIVAL[0],(2.72,2.02,5.45),STAGING_B[0]],[SECRET_ARRIVAL[0],STAGING_B[1]]]
BOARDING_A=[[STAGING_A[i],p] for i,p in enumerate(BERTHS_A)]
BOARDING_B=[[STAGING_B[i],p] for i,p in enumerate(BERTHS_B)]
RIDES=[]
for a,b in zip(BERTHS_A,BERTHS_B):
 RIDES.append([tuple(Vector(a).lerp(Vector(b),i/24)-Vector((0,0,.11*4*(i/24)*(1-i/24)))) for i in range(25)])
CABLE_RIDE=RIDES[0]
# Broad trails have actual joined surfaces; slopes are continuous ramps with flush timber grip strips.
def walkway(n,points,width=1.26,bridge=False):
 pts=[Vector(p) for p in points];sides=[Vector((-(b-a).y,(b-a).x,0)).normalized() for a,b in zip(pts,pts[1:])];top=[]
 for i,p in enumerate(pts):
  side=sides[0] if i==0 else sides[-1] if i==len(pts)-1 else (sides[i-1]+sides[i]).normalized();span=width/2/max(.5,side.dot(sides[min(i,len(sides)-1)]));top.extend([p-side*span,p+side*span])
 verts=top+[p-Vector((0,0,.17)) for p in top];L=len(top);spine=len(verts);verts+=pts;faces=[]
 for i in range(len(pts)-1):
  j=i*2;ca=spine+i;cb=spine+i+1;faces.extend([(j,j+2,cb),(j,cb,ca),(ca,cb,j+3),(ca,j+3,j+1),(L+j,L+j+1,L+j+3,L+j+2),(j,L+j,L+j+2,j+2),(j+1,j+3,L+j+3,L+j+1)])
 faces.extend([(0,1,L+1,L),(L-2,2*L-2,2*L-1,L-1)]);o=mesh('walk_'+n,[tuple(p) for p in verts],faces,timber if bridge else pathmat);bevel(o,.015)
 for k,(a,b) in enumerate(zip(pts,pts[1:])):
  d=b-a;side=Vector((-d.y,d.x,0)).normalized();count=max(2,math.ceil(d.length/.32))
  if bridge or abs(d.z)>.02:
   for i in range(1,count):
    p=a.lerp(b,i/count);beam('walk_'+n+' flush grip',p-side*(width*.47)+Vector((0,0,.008)),p+side*(width*.47)+Vector((0,0,.008)),.01,wood)
  # Structural beams are continuous from one supported terrace to the next.
  for sg in [-1,1]:
   off=side*(width/2-.08)*sg;beam(n+' side stringer',a+off-Vector((0,0,.23)),b+off-Vector((0,0,.23)),.095,wood)
   support_ts=([.5] if d.length>1.35 else []) if bridge else [.12,.87]
   if bridge and k==0:support_ts=[.0]+support_ts
   if bridge and k==len(pts)-2:support_ts=support_ts+[1.0]
   for t in support_ts:
    p=a.lerp(b,t)+off;foot=-.30;beam(n+' anchored timber post',(p.x,p.y,foot),(p.x,p.y,p.z-.17),.085 if bridge else .07,wood)
  if bridge and d.length>1.35:
   beam(n+' diagonal under-deck brace',a.lerp(b,.18)-Vector((0,0,1.05)),a.lerp(b,.82)-Vector((0,0,.25)),.065,wood)
  if bridge and n!='main trail 1':
   # Exterior rails never seal boarding pads; no false walk route on top of a cable.
   for sg in [-1] if n=='main trail 2' else [-1,1]:
    off=side*(width/2+.07)*sg;pa=a.lerp(b,.1)+off;pb=a.lerp(b,.9)+off
    beam(n+' open rail',pa+Vector((0,0,.44)),pb+Vector((0,0,.44)),.023,wood)
    for t in [.10,.5,.90]:
     p=a.lerp(b,t)+off;beam(n+' rail post',p,p+Vector((0,0,.46)),.025,wood)
 return o
for i,p in enumerate(MAIN):walkway('main trail '+str(i),p,1.38,bridge=i in [1,2])
# Each station apron is one closed mesh; branch paths share its uninterrupted floor.
def apron(n,outline,z):
 count=len(outline);vs=[(x,y,z-.015) for x,y in outline]+[(x,y,z-.20) for x,y in outline];fs=[tuple(range(count))]+[(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]+[tuple(range(count*2-1,count-1,-1))]
 mesh('walk_'+n+' uninterrupted deck',vs,fs,timber)
 for x,y in outline:
  beam(n+' real bedrock pile',(x,y,-.30),(x,y,z-.20),.075,wood)
 for (ax,ay),(bx,by) in zip(outline,outline[1:]+outline[:1]):beam(n+' rim joist',(ax,ay,z-.18),(bx,by,z-.18),.10,wood)
# Separate supported approaches reach two well-spaced side-door berths.
# The foreground lane keeps its already verified feet; only the rear lane recedes.
for name,path in [('lower common approach',SECRET_APPROACH),('upper common approach',SECRET_ARRIVAL)]:walkway(name,[(x,y,z-.012) for x,y,z in path],.76)
for terminal,paths,staging,berths,sgn in [('lower',WALK_TO_A,STAGING_A,BERTHS_A,-1),('upper',WALK_TO_B,STAGING_B,BERTHS_B,1)]:
 for i,path in enumerate(paths):
  walkway(terminal+' supported station approach '+str(i),[(x,y,z-.016-i*.004) for x,y,z in path],.74)
  q=staging[i];cube('walk_'+terminal+' side-door staging '+str(i),(q[0],q[1],q[2]-.047),(.66,.80,.08),timber,.014)
  p=berths[i];walkway(terminal+' fixed loading lip '+str(i),[(p[0]+sgn*.73,p[1],p[2]-.024),(p[0]+sgn*.505,p[1],p[2]-.024)],.72)
for key,p in NODES.items():
 if key=='4-5':cube('walk_4-5 rectangular station forecourt',(p[0],p[1],p[2]-.041),(.66,1.40,.12),pathmat,.018)
 else:cyl('walk_'+key+' generous stage landing',(p[0],p[1],p[2]-.041),.84,.12,pathmat,32)
# Boarding platforms replace overlapping round pads in the next cable contract pass.
# Station masonry piers go all the way to the bedrock.
def station(n,x,y,z,w=1.85,d=1.18,h=1.28):
 cube(n+' stone foundation',(x,y,(z+.35)/2),(w+.22,d+.20,z-.35),stone,.05)
 cube(n+' warm plaster',(x,y,z+h/2),(w,d,h),cream,.06)
 for xx in [x-w/2+.05,x+w/2-.05]:cube(n+' blue corner timber',(xx,y-d/2-.018,z+h/2),(.10,.10,h),steel,.012)
 cube(n+' front door',(x-w*.24,y-d/2-.04,z+h*.4),(.38,.055,h*.8),wood,.018)
 cube(n+' warm front window',(x+w*.20,y-d/2-.055,z+h*.56),(.54,.035,.57),glow,.015)
 for xx in [x+w*.05,x+w*.20,x+w*.35]:cube(n+' window mullion',(xx,y-d/2-.080,z+h*.56),(.035,.035,.60),steel,.005)
 # Gabled roofs: real two pitched surfaces plus fascia.
 y0,y1=y-d/2-.16,y+d/2+.16;xx0,xx1=x-w/2-.20,x+w/2+.20;peak=z+h+.65
 mesh(n+' pitched terracotta roof',[(xx0,y0,z+h),(xx1,y0,z+h),(xx1,y,peak),(xx0,y,peak),(xx0,y1,z+h),(xx1,y1,z+h)],[(0,1,2,3),(3,2,5,4)],red)
 for xx in [xx0+i*(xx1-xx0)/12 for i in range(13)]:
  beam(n+' clay roof seam',(xx,y0,z+h+.02),(xx,y,peak+.02),.026,redhi);beam(n+' clay rear seam',(xx,y,peak+.02),(xx,y1,z+h+.02),.026,redhi)
 beam(n+' terracotta ridge cap',(xx0,y,peak+.04),(xx1,y,peak+.04),.075,redhi)
 cube(n+' carved beam',(x,y-d/2-.09,z+h-.12),(w+.10,.16,.17),wood,.02)
 cube(n+' mountain station plaque',(x,y-d/2-.185,z+h-.12),(.40,.04,.27),steel,.02)
 mesh(n+' ivory mountain badge',[(x-.145,y-d/2-.21,z+h-.19),(x+.145,y-d/2-.21,z+h-.19),(x,y-d/2-.21,z+h-.005)],[(0,1,2)],cream)
 for xx in [x-w*.46,x+w*.46]:
  if n=='Biel upper central station' and xx<x:continue
  beam(n+' lantern arm',(xx,y-d/2,z+.8),(xx,y-d/2-.27,z+.8),.025,steel);cube(n+' warm lamp',(xx,y-d/2-.27,z+.68),(.12,.10,.18),glow,.025)
station('lower ascent station',-4.4,1.25,2.83)
# The former central shelter is removed to leave the rear maintenance corridor open.
station('Biel upper central station',4.0,3.08,5.25,2.1,1.4,1.62)
# Station wheels and cable anchors are fixed to their own solid plinths, outside paths.
def tower(n,x,y,z,h=2.25):
 cube(n+' anchored base',(x,y,(z-.30)/2),(.66,.63,z+.30),stone,.04)
 for dx in [-.24,.24]:cube(n+' blue upright',(x+dx,y,z+h/2),(.13,.20,h),steel,.025)
 cube(n+' top crossbeam',(x,y,z+h),(.95,.24,.18),steel,.025)
 bpy.ops.mesh.primitive_torus_add(major_radius=.38,minor_radius=.07,major_segments=32,minor_segments=8,location=(x,y-.02,z+h-.1),rotation=(math.pi/2,0,0));o=bpy.context.object;o.name=n+' brass pulley';assign(o,gold)
 for a in [0,math.pi/3,2*math.pi/3]:beam(n+' pulley spokes',(x-math.cos(a)*.35,y-.02,z+h-.1-math.sin(a)*.35),(x+math.cos(a)*.35,y-.02,z+h-.1+math.sin(a)*.35),.035,gold)
 cyl(n+' pulley axle',(x,y-.15,z+h-.10),.09,.3,steel).rotation_euler.x=math.pi/2
 return (x,y,z+h+.10)
A=tower('lower passenger tower',-5.25,1.90,2.84,2.6);B=tower('upper passenger tower',4.65,3.35,5.25,2.65)
# Passenger-line towers stay reserved; the inactive scenic span is not built across the maintenance corridor.
def cabin(n,x,y,z,s=.80):
 cube(n+' red lower body',(x,y,z+.30*s),(s,.72*s,.60*s),red,.055)
 cube(n+' blue glazing',(x,y,z+.85*s),(s*.96,.70*s,.57*s),glass,.05)
 for dx in [-.48,.0,.48]:cube(n+' ivory glass pillar',(x+dx*s,y-.37*s,z+.85*s),(.055*s,.06*s,.61*s),cream,.008)
 cube(n+' blue roof',(x,y,z+1.20*s),(1.12*s,.85*s,.13*s),steel,.05)
 cube(n+' cream belt',(x,y-.38*s,z+.60*s),(s,.055*s,.07*s),cream,.008)
 beam(n+' hanger',(x,y,z+1.2*s),(x,y,z+1.70*s),.045,steel)
 cube(n+' cable grip',(x,y,z+1.72*s),(.27*s,.22*s,.15*s),gold,.025)
 # Readable ivory mountain badge on the actual cabin front.
 mesh(n+' mountain symbol',[(x-.14*s,y-.382*s,z+.20*s),(x+.14*s,y-.382*s,z+.20*s),(x,y-.382*s,z+.45*s)],[(0,1,2)],cream)
# The two active maintenance carriers provide the suspended-cabin silhouette.
# Two fixed counterbalanced carriers exchange ends without a fictitious teleport or empty-car recall.
# Independent compact terminal supports stay beside each berth, clear of the other doorway's sightline.
for stationname,berths in [('lower maintenance terminal',BERTHS_A),('upper maintenance terminal',BERTHS_B)]:
 for lane,foot in enumerate(berths):
  q=Vector(foot);p=q+Vector((-.50,.65,0))
  cube(stationname+' stone anchor '+str(lane),(p.x,p.y,.40),(.54,.54,1.40),stone,.035)
  post_top=1.68 if stationname.startswith('upper') and lane==1 else 2.0
  beam(stationname+' side blue support '+str(lane),(p.x,p.y,.4),p+Vector((0,0,post_top)),.10,steel)
  beam(stationname+' short sheave support '+str(lane),p+Vector((0,0,post_top)),q+Vector((0,0,2.0)),.055,steel)
  o=cyl(stationname+' sheave',q+Vector((0,0,1.72)),.18,.13,gold,20);o.rotation_euler.x=math.pi/2
for lane,ride in enumerate(RIDES):curve('maintenance paired cable lane '+str(lane),[(x,y,z+1.70) for x,y,z in ride],.026,steel)
PHASE=1 if '--pair-phase1' in sys.argv else 0
cabin('maintenance carrier A',*BERTHS_A[PHASE],1.0);cabin('maintenance carrier B',*BERTHS_B[1-PHASE],1.0)
# Taller hangers keep the cable itself above even the far-berth walking silhouette.
for name,p in [('maintenance carrier A',BERTHS_A[PHASE]),('maintenance carrier B',BERTHS_B[1-PHASE])]:
 for ob in list(bpy.context.scene.objects):
  if ob.name in {name+' hanger',name+' cable grip'}:bpy.data.objects.remove(ob,do_unlink=True)
 beam(name+' hanger',(p[0],p[1],p[2]+1.20),(p[0],p[1],p[2]+1.70),.045,steel)
 cube(name+' cable grip',(p[0],p[1],p[2]+1.70),(.27,.22,.15),gold,.025)
# Open compartment, raised headroom and side frames keep the real Feka sprite visible.
# The floor is real; there is no opaque cube lid across the passenger's chest.
for name,p in [('maintenance carrier A',BERTHS_A[PHASE]),('maintenance carrier B',BERTHS_B[1-PHASE])]:
 for ob in list(bpy.context.scene.objects):
  if ob.name in {name+' red lower body',name+' blue glazing',name+' mountain symbol',name+' hanger'} or ob.name.startswith(name+' ivory glass pillar'):bpy.data.objects.remove(ob,do_unlink=True)
 cube(name+' interior floor',(p[0],p[1],p[2]-.025),(1.0,.72,.05),steel,.01)
 for label,yy in [('front',-.34),('rear',.34)]:cube(name+' '+label+' red wall',(p[0],p[1]+yy,p[2]+.19),(1.0,.045,.38),red,.02)
 for label,xx in [('left',-.475),('right',.475)]:
  # Side doorway stays open for left-side departure and right-side arrival.
  cube(name+' '+label+' rear pillar',(p[0]+xx,p[1]+.34,p[2]+.875),(.055,.06,.97),cream,.008)
  beam(name+' canopy diagonal stay',(p[0]+xx,p[1]+.34,p[2]+1.2),(p[0]+xx,p[1]-.24,p[2]+1.39),.026,cream)
 cube(name+' rear blue glazing',(p[0],p[1]+.34,p[2]+.875),(.90,.025,.95),glass,.012)
 roof=bpy.data.objects.get(name+' blue roof');roof.location.z=p[2]+1.39;roof.dimensions=(1.0,.48,.08)
 belt=bpy.data.objects.get(name+' cream belt');belt.location.z=p[2]+.39
 beam(name+' hanger',(p[0],p[1],p[2]+1.39),(p[0],p[1],p[2]+1.70),.045,steel)
 mesh(name+' mountain symbol',[(p[0]-.14,p[1]-.367,p[2]+.08),(p[0]+.14,p[1]-.367,p[2]+.08),(p[0],p[1]-.367,p[2]+.32)],[(0,1,2)],cream)
# Visible secret flag at the upper station, separated from the landing.
beam('maintenance secret pennant pole',(2.65,3.05,5.25),(2.65,3.05,7.7),.035,wood)
mesh('maintenance lilac pennant',[(2.65,3.05,7.65),(3.18,3.05,7.50),(2.65,3.05,7.25)],[(0,1,2)],violet)
# Distinctive layered fir silhouettes, with trunks rooted on rock crowns.
def fir(n,x,y,z,s=1):
 cyl(n+' trunk',(x,y,z+.53*s),.065*s,1.10*s,wood,10)
 for i,(r,dz,h) in enumerate([(.47,.67,.94),(.36,1.08,.85),(.25,1.46,.74)]):
  verts=[(x,y,z+(dz+h/2)*s)]+[(x+math.cos(j*math.pi/6)*r*s*(1 if j%2 else .88),y+math.sin(j*math.pi/6)*r*s*(1 if j%2 else .88),z+(dz-h/2+(0 if j%2 else .11))*s) for j in range(12)];faces=[(0,1+j,1+(j+1)%12) for j in range(12)]+[tuple(range(12,0,-1))];mesh(n+' tier of notched pine branches',verts,faces,pinehi if i==2 else pine)
for i,p in enumerate([(-3.95,2.0,5.32,.60),(-1.24,3.7,6.13,.45),(5.85,2.40,5.46,.55),(-5.1,2.1,3.13,.75),(4.9,3.45,5.28,.55),(5.65,-.65,3.23,.65)]):fir('mountain pine '+str(i),*p)
# Restrained grain belongs to the materials, keeping the audited walking solids unchanged.
for material,depth,scale in [(stone,.035,6),(light,.03,6),(shadow,.025,7),(wood,.018,11),(timber,.014,12),(red,.018,16)]:
 nt=material.node_tree;principled=nt.nodes.get('Principled BSDF');base=tuple(principled.inputs['Base Color'].default_value[:3]);coord=nt.nodes.new('ShaderNodeTexCoord');noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=scale;noise.inputs['Detail'].default_value=2.2;nt.links.new(coord.outputs['Generated'],noise.inputs['Vector']);ramp=nt.nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.12;ramp.color_ramp.elements[0].color=tuple(v*.91 for v in base)+(1,);ramp.color_ramp.elements[1].position=.85;ramp.color_ramp.elements[1].color=tuple(min(1,v*1.07) for v in base)+(1,);nt.links.new(noise.outputs['Fac'],ramp.inputs[0]);nt.links.new(ramp.outputs[0],principled.inputs['Base Color']);bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.13;bump.inputs['Distance'].default_value=depth;nt.links.new(noise.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs[0],principled.inputs['Normal'])
# Camera family matches the released models but reserves vertical room for the mountain.
scene=bpy.context.scene;bpy.ops.object.camera_add(location=(11,-20,18.85));cam=bpy.context.object;target=Vector((0,.25,3.6));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=20.6;scene.camera=cam
world=bpy.data.worlds.new('lilac mountain atmosphere');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.62,.58,.80,1);world.node_tree.nodes['Background'].inputs[1].default_value=.55
for name,loc,power,size,color in [('golden key',(-8,-10,19),2400,9,(1,.83,.65)),('lilac fill',(8,3,13),1700,8,(.73,.70,1)),('mountain rim',(-4,10,17),1800,7,(.96,.90,1))]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,2))-o.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=64 if FINAL else 8;scene.cycles.use_denoising=False;scene.cycles.max_bounces=5;scene.render.resolution_x=1920;scene.render.resolution_y=1200;scene.render.resolution_percentage=100 if FINAL else 50;scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.30
bpy.context.view_layer.update()
def project(co):
 p=world_to_camera_view(scene,cam,Vector(co));return {'x':round(p.x,6),'y':round(1-p.y,6)}
meta={'version':1,'world':4,'status':'local-prototype-not-runtime-approved','size':{'width':1920,'height':1200},'camera':{'position':list(cam.location),'target':list(target),'orthoScale':cam.data.ortho_scale},'nodes':{key:{**project(p),'world':list(p),'clearingRadius':.33 if key=='4-5' else .84} for key,p in NODES.items()},'routes':{f'{i}:{i+1}':[project(p) for p in route] for i,route in enumerate(MAIN)},'secretTransport':'maintenance-cable','secretRoute':[],'worldRoutes':{'main':[{'from':f'4-{i+1}','to':f'4-{i+2}','world':route,'movement':'walk'} for i,route in enumerate(MAIN)],'secretApproach':[{'world':SECRET_APPROACH,'movement':'walk'}],'secretArrival':[{'world':SECRET_ARRIVAL,'movement':'walk'}],'terminalWalkA':[{'world':path,'movement':'walk'} for path in WALK_TO_A],'terminalWalkB':[{'world':path,'movement':'walk'} for path in WALK_TO_B],'boardingA':[{'world':path,'movement':'board'} for path in BOARDING_A],'boardingB':[{'world':path,'movement':'board'} for path in BOARDING_B]},'maintenanceCabin':{'status':'paired-geometry-prototype-not-integrated','phase':PHASE,'departureBerths':BERTHS_A,'arrivalBerths':BERTHS_B,'walkToDeparture':WALK_TO_A,'walkToArrival':WALK_TO_B,'boardingDeparture':BOARDING_A,'boardingArrival':BOARDING_B,'passengerFootPaths':RIDES,'overheadCableZOffset':1.70,'laneDistance':LANE_DISTANCE,'cabinsExchangeEnds':True,'walkAlongCableAllowed':False},'futureExit':{'world':5,'status':'reserved-only','campaignUnlock':'4-5 B2','mode':'passenger-cable-car','reservedAround':[1.65,2.9,5.45]},'campaignSources':['docs/world/campanha.md:162-208','docs/world/conceitos/imagens/04-serra-suspensa.png','docs/world/conceitos/imagens/13-arquipelago.png']}
assert all(mod.type!='BOOLEAN' for ob in scene.objects for mod in ob.modifiers)
# Runtime projection and timing are exported from the same camera as the art.
WALK_SPEED=1.73;CABLE_SPEED=2.10
length3=lambda points:sum((Vector(a)-Vector(b)).length for a,b in zip(points,points[1:]))
length2=lambda points:sum(math.hypot((a['x']-b['x'])*1.6,a['y']-b['y']) for a,b in zip(points,points[1:]))
project_route=lambda points:[project(point) for point in points]
meta['routeDurationsSeconds']={str(i)+':'+str(i+1):round(length3(path)/WALK_SPEED,6) for i,path in enumerate(MAIN)}
stations={name:{'stage':stage,'platform':project(path[-1]),'stageToPlatform':project_route(path),'approachDurationSeconds':round(length3(path)/WALK_SPEED,6)} for name,stage,path in [('lower','4-3',SECRET_APPROACH),('upper','4-5',list(reversed(SECRET_ARRIVAL)))]}
lanes={}
for i,name in enumerate(['a','b']):
 lower=WALK_TO_A[i]+BOARDING_A[i][1:];upper=WALK_TO_B[i]+BOARDING_B[i][1:];lane={}
 for terminal,path,foot,sgn in [('lower',lower,BERTHS_A[i],-1),('upper',upper,BERTHS_B[i],1)]:
  pp=project_route(path);door=(foot[0]+sgn*.50,foot[1],foot[2]);lane[terminal]={'foot':project(foot),'boardingRoute':pp,'boardingDurationSeconds':round(length3(path)/WALK_SPEED,6),'aboardProgress':round(1-length2(project_route([door,foot]))/length2(pp),9)}
 lane['pathPoints']=project_route(RIDES[i]);lanes[name]=lane
meta['maintenanceProjection']={'version':1,'world':4,'coordinateSystem':'island-local','paintOrder':['a','b'],'stations':stations,'lanes':lanes,'rideDurationSeconds':round(length3(RIDES[0])/CABLE_SPEED,6)}
foot=project(BERTHS_A[PHASE]);meta['cabinFrameProjection']={'width':1920,'height':1200,'passengerFootPixels':{'x':foot['x']*1920,'y':foot['y']*1200},'passengerPixelScale':1920*(4.15/20.6)*3/384,'sourceCarrier':'maintenance carrier A'}
meta['timingCalibration']={'walkWorldUnitsPerSecond':WALK_SPEED,'cableWorldUnitsPerSecond':CABLE_SPEED,'source':'Walk pace matches released cargo bridge5.54/3.2; cable modestly faster; no route cost overrides.'}
# Export authored scene
# runpy callers may set FEKA_SERRA_BUILD_ONLY=True and consume scene/meta directly.
scene['serra_metadata']=json.dumps(meta)
if not BUILD_ONLY:
 json.dump(meta,open(os.path.join(OUT,'serra-prototype.meta.json'),'w'),indent=2)
 bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'serra-prototype.blend'))
 if '--static' in ARGS:
  for ob in scene.objects:
   if ob.name.startswith(('maintenance carrier A','maintenance carrier B')):ob.hide_render=True
 scene.render.filepath=os.path.join(OUT,'serra-diorama.png' if '--static' in ARGS else 'serra-prototype'+('-final' if FINAL else '-phase1' if PHASE else '-low')+'.png')
 bpy.ops.render.render(write_still=True)
 print('SERRA_RENDER='+scene.render.filepath)

 if '--export-cabin-layers' in ARGS:
  car=[ob for ob in scene.objects if ob.name.startswith('maintenance carrier A')]
  front=[ob for ob in car if any(token in ob.name for token in ['front red wall','canopy diagonal stay','cream belt','mountain symbol','blue roof'])]
  rear=[ob for ob in car if ob not in front]
  scene.render.resolution_percentage=100;scene.cycles.samples=32
  for layer,objects in [('rear',rear),('foreground',front)]:
   for ob in scene.objects:ob.hide_render=ob.type not in {'LIGHT','CAMERA'} and ob not in objects
   scene.render.filepath=os.path.join(OUT,'maintenance-cabin-'+layer+'-full.png');bpy.ops.render.render(write_still=True)
