"""Authored third craft pass; executed by build_guaira.py in its scene namespace.

No water surface, camera, light, path, node or island silhouette is moved. All
new scenery belongs to existing buildings or to deliberately grouped dry banks.
"""
random.seed(61028)
# Direct datablock primitives keep this detail pass portable and quick even when
# the base already contains thousands of objects. These match the original helper
# geometry/material conventions without a scene-wide operator update per prop.
def cube(n,p,d,m,r=.02):
 dx,dy,dz=[v/2 for v in d]
 vs=[(-dx,-dy,-dz),(-dx,-dy,dz),(-dx,dy,-dz),(-dx,dy,dz),(dx,-dy,-dz),(dx,-dy,dz),(dx,dy,-dz),(dx,dy,dz)]
 ob=mesh(n,vs,[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)],m);ob.location=p
 if r:bevel(ob,r)
 return ob
def cyl(n,p,r,d,m,v=16):
 vs=[(r*math.cos(k*math.tau/v),r*math.sin(k*math.tau/v),z) for z in [-d/2,d/2] for k in range(v)]
 fs=[tuple(range(v-1,-1,-1)),tuple(range(v,2*v))]+[(k,(k+1)%v,(k+1)%v+v,k+v) for k in range(v)]
 ob=mesh(n,vs,fs,m);ob.location=p;return ob
stucco_ochre=mat('Neighborhood warm limewash','D9AD70')
stucco_chalk=mat('Granary sunwashed lime','DFCEAB')
stucco_sand=mat('Workshop old sand plaster','C5AA80')
shutter=mat('Workshop weathered teal wood','426F69')
shutterhi=mat('Shutter exposed edges','6C9280')
doorwood=mat('Doors aged chestnut','795036')
mortar=mat('Village foundation mortar','8D8067')
brick=mat('Exposed warm handmade brick','A96240')
cloth=mat('Workshop faded sage canvas','7E8970')
drygrass=mat('Dry bank straw','A68D55')
grassgreen=mat('Dry bank olive shoots','788545')
harvestgold=mat('Harvest mature grain','B4A35B')
tiles=[mat('Handmade tile '+str(i),h) for i,h in enumerate(['B55536','C36943','B9603A','CF7950','A94F34'])]
for material,colors in [(stucco_ochre,[(.15,'C99E68'),(.85,'E1BE88')]),(stucco_chalk,[(.15,'CEBA98'),(.85,'E8D9B7')]),(stucco_sand,[(.15,'B5A17D'),(.85,'D5BE94')])]:
 color_noise(material,colors,7)

def material_replace(o,material):
 o.data.materials.clear();o.data.materials.append(material)

def tile_roof(n,x,y,z,w,d,h):
 """Curved clay shells with actual overlapping courses and visible end lips."""
 remove_prefix(n+' ridge tile',n+' back tile',n+' cap')
 a,b=x-w/2-.13,x+w/2+.13;half=d/2+.14;peak=z+h+.37
 material_replace(bpy.data.objects[n+' gabled roof'],tiledeep)
 columns=max(7,round((b-a)/.145));pitch=(b-a)/columns
 courses=max(3,round(half/.15))
 for side in [-1,1]:
  for row in range(courses):
   low=half*(1-row/courses);high=max(0,half*(1-(row+1)/courses)-.025)
   for col in range(columns):
    xx=a+(col+.5)*pitch
    # Tiles overlap toward the eave; each lower end has a tiny raised edge.
    vs=[]
    for tt in [low+.018,high]:
     for k in range(7):
      aa=k*math.pi/6;dx=math.cos(aa)*pitch*.49
      zz=peak-.37*tt/half+.027+math.sin(aa)*pitch*.30+(courses-row)*.002
      vs.append((xx+dx,y+side*tt,zz))
    ob=mesh(n+' curved clay tile',vs,[(k,k+1,k+8,k+7) for k in range(6)],tiles[(row*2+col+(0 if n.startswith('Neighborhood') else 2))%len(tiles)])
    # The dark underside is thick geometry, not a line painted on the roof.
    mesh(n+' tile end thickness',[vs[k] for k in range(7)]+[(vx,vy,vz-.020) for vx,vy,vz in vs[:7]],[(k,k+1,k+8,k+7) for k in range(6)],roof)
 for k in range(columns):
  aa=a+k*pitch;bb=aa+pitch*.97
  beam(n+' curved ridge cap',(aa,y,peak+.065),(bb,y,peak+.065),.065,tiles[(k+2)%len(tiles)])

def shutter_window(n,x,y,z,w=.30,h=.32):
 # Recess, projecting jambs, paired shutters and broad louver silhouettes.
 cube(n+' recessed glass',(x,y,z),(w+.06,.035,h+.05),dark,.014)
 for side in [-1,1]:
  xx=x+side*w*.29
  cube(n+' shutter leaf',(xx,y-.033,z),(w*.45,.050,h),shutter,.008)
  for j in range(5):
   ob=cube(n+' shutter louver',(xx,y-.066,z-h*.37+j*h*.185),(w*.40,.042,.027),shutterhi,.004);ob.rotation_euler.x=-.18
  for dx in [-w*.21,w*.21]:cube(n+' shutter stile',(xx+dx,y-.070,z),(.025,.035,h+.028),shutter,.006)
 cube(n+' stone sill',(x,y-.05,z-h/2-.04),(w+.15,.16,.065),cream,.012)
 cube(n+' window lintel',(x,y-.035,z+h/2+.06),(w+.12,.11,.065),timber,.012)

houses=[('Neighborhood home',-4.4,1.4,Z,1.3,.92,1.0,stucco_ochre),('Repair shop',-2.7,1.35,Z,1.2,.9,.85,stucco_sand),('Small granary',-5.3,2.6,Z,.95,.8,.8,stucco_chalk)]
for ni,(n,x,y,z,w,d,h,wall) in enumerate(houses):
 material_replace(bpy.data.objects[n+' plaster'],wall)
 tile_roof(n,x,y,z,w,d,h)
 # Footings are set into the unchanged foundation, with staggered larger stones.
 material_replace(bpy.data.objects[n+' foundation'],mortar)
 for k in range(5):
  xx=x-w/2+(k+.5)*w/5
  cube(n+' dressed front footing',(xx,y-d/2-.045,z+.075),(w/5-.014,.14,.155),wetstone if (k+ni)%3 else stone,.024)
 for k in range(3):
  yy=y-d/2+(k+.5)*d/3
  cube(n+' dressed side footing',(x+w/2+.025,yy,z+.075),(.13,d/3-.018,.155),stone if k%2 else wetstone,.025)
 # Doors retain their exact opening and receive individual boards, jambs and latch.
 dx=x-w*.22;front=y-d/2-.063
 for k in range(4):cube(n+' door plank',(dx-.12+k*.080,front,z+.34),(.071,.033,.62),doorwood,.005)
 for xx in [dx-.168,dx+.168]:cube(n+' doorway jamb',(xx,front+.006,z+.35),(.060,.065,.71),timber,.011)
 cube(n+' doorway lintel',(dx,front-.005,z+.72),(.41,.08,.075),timber,.012)
 cube(n+' threshold',(dx,front-.10,z+.11),(.39,.24,.075),stone,.015)
 for zz in [z+.21,z+.55]:cube(n+' door iron hinge',(dx-.05,front-.030,zz),(.18,.019,.027),dark,.003)
 cyl(n+' brass door latch',(dx+.078,front-.055,z+.34),.020,.027,brass,10).rotation_euler.x=math.pi/2
 remove_prefix(n+' window')
 shutter_window(n,x+w*.22,y-d/2-.056,z+.60,.30,.30)
 # A few large irregular plaster losses reveal actual masonry at the dry base.
 for ci,(bx,bz) in enumerate([(x-w*.41,z+.22),(x+w*.36,z+.19)]):
  for rr in range(2):
   for col in range(2-rr):
    cube(n+' exposed masonry',(bx+col*.13+rr*.055,front+.010,bz+rr*.082),(.115,.025,.065),brick,.01)
 # Weathered end-grain rafter feet under the original eaves.
 for k in range(5):cube(n+' exposed eave rafter',(x-w*.44+k*w*.22,y-d/2-.092,z+h-.025),(.055,.23,.08),timber,.01)
 # The visible east wall carries its own small opening; the granary uses a vent.
 sx=x+w/2+.017
 cube(n+' side shadow opening',(sx,y+.04,z+h*.58),(.027,.27,.30),dark,.01)
 for yy in [y-.09,y+.03,y+.15]:cube(n+' side vent board',(sx+.030,yy,z+h*.58),(.055,.065,.30),shutter if ni<2 else timber,.006)
 cube(n+' side sill',(sx+.06,y+.03,z+h*.58-.19),(.16,.38,.065),cream,.012)

# One readable work bay belongs to the repair house, entirely behind the road.
bx,by=-1.69,1.46
for dx in [-.43,.43]:
 for dy in [-.43,.43]:beam('Repair bay timber post',(bx+dx,by+dy,1.79),(bx+dx,by+dy,2.62 if dy>.0 else 2.47),.043,wood)
mesh('Repair bay sage canvas',[(bx-.52,by-.52,2.48),(bx+.53,by-.52,2.48),(bx+.53,by+.49,2.66),(bx-.52,by+.49,2.66)],[(0,1,2,3)],cloth)
for dx in [-.52,.52]:beam('Repair bay side brace',(bx+dx,by-.52,2.48),(bx+dx,by+.49,2.66),.035,timber)
beam('Repair bay front lintel',(bx-.52,by-.52,2.48),(bx+.52,by-.52,2.48),.045,timber)
cube('Repair bay workbench',(bx,by+.16,2.12),(.79,.36,.095),timber,.014)
for dx in [-.31,.31]:beam('Workbench legs',(bx+dx,by+.15,1.79),(bx+dx,by+.15,2.12),.045,wood)
cube('Workbench lower shelf',(bx,by+.17,1.91),(.72,.31,.055),wood,.008)
for k in range(3):cube('Workshop stored planks',(bx-.17,by+.19,1.96+k*.043),(.45,.13,.033),timber,.006)
beam('Workshop spare pipe',(bx-.28,by+.14,2.20),(bx+.16,by+.14,2.20),.048,patina)
for xx in [bx-.25,bx+.12]:
 ob=cyl('Workshop spare pipe collar',(xx,by+.14,2.20),.069,.033,brass,12);ob.rotation_euler.y=math.pi/2
bpy.ops.mesh.primitive_torus_add(major_radius=.12,minor_radius=.025,major_segments=14,minor_segments=6,location=(bx+.29,by+.35,2.27),rotation=(math.pi/2,0,0));assign(bpy.context.object,patina);bpy.context.object.name='Workshop spare handwheel'
for k in range(3):beam('Workshop leaning poles',(bx+.38+k*.06,by+.31,1.80),(bx+.20+k*.06,by+.35,2.37),.020,timber)

# Sparse natural groups: olive shoots grow in sheltered rock/cactus pockets.
def grass_clump(n,x,y,z,s=1,green=False):
 for j in range(7):
  a=j*2.399+random.uniform(-.2,.2);reach=random.uniform(.10,.17)*s;h=random.uniform(.14,.24)*s
  matl=grassgreen if green and j%3 else drygrass
  mesh(n,[(x-.016*s,y,z),(x+.016*s,y,z),(x+math.cos(a)*reach*.55,y+math.sin(a)*reach*.55,z+h*.78),(x+math.cos(a)*reach,y+math.sin(a)*reach,z+h)],[(0,1,2),(0,2,3)],matl)
for x,y,sz in [(-5.55,1.30,.88),(-4.9,2.0,.86),(-4.69,3.18,.82),(-2.03,2.73,.91),(-3.40,-3.42,.90),(-1.34,-3.48,.86),(.13,.92,.91),(5.81,.79,.94)]:
 for dx,dy,s in [(-.18,.02,1),(.14,.11,.75),(.01,-.17,.62)]:
  if clear(x+dx,y+dy,1.0):grass_clump('Sheltered dry vegetation',x+dx,y+dy,1.78,sz*s,True)

# Rice maturation retains every existing leaf and water surface. Small green-gold
# bowed heads occupy alternate clumps; there is no uniform yellow flower carpet.
existing_heads=[ob for ob in bpy.data.objects if ob.name.startswith('Rice grain head')]
for index,ob in enumerate(existing_heads):
 if index%2:continue
 p=ob.location.copy();p.z=2.055
 ps=[(p.x,p.y,p.z),(p.x+.018,p.y,2.16),(p.x+.060,p.y+.008,2.19),(p.x+.095,p.y+.009,2.14)]
 curve('Bowed mature rice panicle',ps,.010,harvestgold)
 for k in range(3):
  beam('Rice grain pair',(p.x+.031+k*.02,p.y-.012,2.165-k*.004),(p.x+.054+k*.02,p.y+.017,2.157-k*.004),.014,harvestgold)

# Compact keeper/harvest group on the east dry bank: a low shade rack, grain
# bundles and tool container. It does not expand the island or any paddy.
hx,hy=5.89,-2.13
for dx in [-.24,.24]:
 for dy in [-.29,.29]:beam('Keeper rack upright',(hx+dx,hy+dy,1.70),(hx+dx,hy+dy,2.31),.029,wood)
for k in range(6):cube('Keeper rack shade slat',(hx,hy-.30+k*.12,2.33),(.64,.104,.05),timber,.008)
cube('Keeper rack dry shelf',(hx,hy,1.85),(.55,.58,.045),wood,.007)
for j,(dx,dy) in enumerate([(-.13,-.10),(.13,.02),(-.06,.16)]):
 x,y=hx+dx,hy+dy
 for k in range(9):
  a=k*math.tau/9;beam('Tied harvested rice stalk',(x+math.cos(a)*.10,y+math.sin(a)*.08,1.87),(x+math.cos(a)*.095,y+math.sin(a)*.08,2.11+(k%3)*.018),.009,drygrass)
 cyl('Harvest bundle binding',(x,y,1.99),.050,.037,timber,10)
# One finished sheaf stands just outside the rack's shade so this activity reads
# at map scale; the rest of the bank stays open and drought colored.
x,y=hx-.02,hy-.49
for k in range(14):
 a=k*math.tau/14
 curve('Foreground harvested sheaf',[(x+math.cos(a)*.10,y+math.sin(a)*.075,1.78),(x+math.cos(a)*.037,y+math.sin(a)*.029,1.98),(x+math.cos(a)*.13,y+math.sin(a)*.09,2.15)],.010,drygrass)
 beam('Harvest sheaf grain',(x+math.cos(a)*.13,y+math.sin(a)*.09,2.15),(x+math.cos(a)*.145,y+math.sin(a)*.10,2.20),.018,harvestgold)
cyl('Foreground sheaf tie',(x,y,1.98),.057,.031,timber,12)
beam('Keeper spare rake shaft',(hx+.21,hy+.31,1.76),(hx+.29,hy+.29,2.32),.017,timber)
beam('Keeper rake crossbar',(hx+.14,hy+.28,2.28),(hx+.43,hy+.28,2.28),.021,wood)
for x,y in [(5.84,-1.62),(5.83,-2.83),(4.91,-4.07)]:grass_clump('Damp bank sedge',x,y,1.78,.88,True)

# Reservoir outlet gains a seated stone throat and gate; water vertices remain
# exactly the original geometry. Existing cropped atlas is regenerated for these
# new foreground occluders without enlarging any animated-water region.
remove_prefix('Reservoir sluice stone pier','Reservoir sluice wooden shutter')
for dx in [-.30,.30]:
 cube('Reservoir throat lower seat',(4.5+dx,2.26,2.48),(.22,.34,.34),wetstone,.024)
 cube('Reservoir throat cap',(4.5+dx,2.26,2.68),(.25,.38,.10),stone,.024)
 cube('Reservoir shutter guide',(4.5+dx*.72,2.255,2.56),(.033,.17,.36),patina,.005)
cube('Reservoir seated shutter',(4.5,2.27,2.58),(.40,.13,.23),wood,.009)
for zz in [2.51,2.65]:cube('Reservoir shutter metal strap',(4.5,2.187,zz),(.41,.025,.027),patina,.004)
beam('Reservoir crosshead',(4.17,2.27,2.78),(4.83,2.27,2.78),.045,brass)
# The narrow masonry returns physically meet the existing sloped canal rails.
for sg in [-1,1]:
 beam('Outlet fitted sandstone return',(4.5+sg*.21,2.27,2.60),(4.5+sg*.21,2.12,2.43),.073,wetstone)
 for t in [.18,.50,.82]:
  yy=2.35-.8*t;zz=2.66-.8*t
  cube('Descent bank masonry joint',(4.5+sg*.235,yy,zz),(.075,.10,.095),wetstone,.018)
# A bank-side foothold and broad pipe brackets explain maintenance access.
for j in range(5):cube('Reservoir bank service board',(5.43,2.58+j*.11,2.46),(.39,.095,.06),timber,.01)
for yy in [2.55,3.04]:beam('Reservoir deck support',(5.38,yy,2.05),(5.38,yy,2.47),.040,wood)
for p in [(3.42,3.0,2.80),(4.09,3.0,2.80)]:
 x,y,z=p
 cube('Bronze pipe masonry shoe',(x,y,2.01),(.23,.24,.16),wetstone,.025)
 for dx in [-.085,.085]:beam('Bronze pipe twin bracket',(x+dx,y,2.10),(x+dx,y,z-.035),.025,patina)

print('GUAIRA_CRAFT_PASS=third authored geometry/material pass; exact layout and water surfaces retained')
