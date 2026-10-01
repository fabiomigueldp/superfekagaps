"""Bounded factory craft pass. Apply once to a freshly constructed base namespace.
No files, render, networking, runtime or publication side effects.
The canonical renderer may run apply(globals()) immediately before its audit boundary.
"""
import bpy,math,json,random
from mathutils import Vector

def apply(ns):
    scene=bpy.context.scene
    cam=scene.camera
    meta=ns['meta']
    baseline=json.loads(json.dumps(meta))
    base_objects=list(scene.objects);base_names=set(o.name for o in base_objects)
    # Fingerprint the authored walking surfaces and lighting before any enrichment.
    def geometry_record(o):
     return {'matrix':[list(r) for r in o.matrix_world],'vertices':[list(v.co) for v in o.data.vertices] if o.type=='MESH' else [],'modifiers':[(m.name,m.type) for m in o.modifiers]}
    walk_before={o.name:geometry_record(o) for o in base_objects if o.name.startswith(('walk_','quality access','quality terrace','maintenance'))}
    light_before={o.name:{'position':list(o.location),'rotation':list(o.rotation_euler),'power':o.data.energy,'color':list(o.data.color),'size':o.data.size} for o in base_objects if o.type=='LIGHT'}
    removed=[];changed=[];group=''
    def remove_matching(test):
     for o in list(scene.objects):
      if test(o):removed.append(o.name);bpy.data.objects.remove(o,do_unlink=True)
    def tag(o):o.name='enrich_'+group+' '+o.name;o['factory_enrichment_group']=group;return o
    def cube(n,p,d,m,r=.02,rot=0):return tag(ns['cube'](n,p,d,m,r,rot))
    def cyl(n,p,r,d,m,nv=24):return tag(ns['cyl'](n,p,r,d,m,nv))
    def beam(n,a,b,r,m,nv=12):return tag(ns['beam'](n,a,b,r,m,nv))
    def curve(n,p,r,m):return tag(ns['curve'](n,p,r,m))
    def ico(n,p,s,m):return tag(ns['ico'](n,p,s,m))
    def mesh(n,v,f,m):return tag(ns['mesh'](n,v,f,m))
    def torus(n,p,r,t,m,rot=(0,0,0)):
     bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=t,major_segments=24,minor_segments=8,location=p,rotation=rot);o=bpy.context.object;o.name=n;ns['assign'](o,m);return tag(o)
    def material(n,c,rough=.65,metal=0):return ns['mat']('Factory craft '+n,c,rough,metal)
    def assign(o,m):o.data.materials.clear();o.data.materials.append(m);changed.append(o.name)
    blue,edge,dark,cream,purple,lilac,copper,copperhi,coral,wood,leaf,white,sand,stone=[ns[n] for n in ['blue','edge','dark','cream','purple','lilac','copper','copperhi','coral','wood','leaf','white','sand','stone']]
    silver=material('brushed ivory alloy',(.84,.86,.78),.32,.43);copperdark=material('aged bronze shadow',(.43,.24,.12),.40,.50);patina=material('copper teal oxide',(.28,.48,.42),.67,.25)
    roofblue=material('deep ocean standing metal',(.20,.43,.57),.39,.35);roofroll=material('sunlit blue rib',(.36,.61,.72),.37,.28)
    warmwall=material('bottling warm ivory',(.91,.75,.46));interiordark=material('bottling deep inset',(.19,.22,.20));terracotta=material('quality terracotta roofing',(.71,.28,.16));terracottahi=material('quality orange ridge',(.87,.40,.22))
    window=material('golden inspection window',(.87,.62,.28),.3);p=window.node_tree.nodes['Principled BSDF'];p.inputs['Emission Color'].default_value=(.75,.31,.055,1);p.inputs['Emission Strength'].default_value=.17
    wetstone=material('damp tide charcoal',(.24,.34,.33));rockwarm=material('warm split coastal rock',(.58,.53,.42));rocklight=material('pale fractured rock',(.70,.66,.52));moss=material('masonry salt moss',(.33,.45,.19));green2=material('coastal bright leaf',(.40,.59,.19));green3=material('sunlit folded leaf',(.59,.70,.24));foam=material('soft pale water contact',(.56,.78,.73));rope=material('coarse rope',(.70,.56,.34));woodhi=material('honey pallet edges',(.74,.51,.26));floorwarm=material('courtyard warm grey',(.64,.64,.54))
    # Manufactured surfaces receive subtle, low-frequency variation rather than noisy dirt.
    for m,strength,scale in [(silver,.06,28),(copper,.07,12),(copperhi,.04,18),(floorwarm,.10,10),(rockwarm,.13,7),(rocklight,.08,8)]:
     nt=m.node_tree;p=nt.nodes['Principled BSDF'];tex=nt.nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=scale;tex.inputs['Detail'].default_value=2;coord=nt.nodes.new('ShaderNodeTexCoord');nt.links.new(coord.outputs['Generated'],tex.inputs['Vector']);bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=strength;bump.inputs['Distance'].default_value=.02;nt.links.new(tex.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],p.inputs['Normal'])
    for o in base_objects:
     if o.name=='walk_irregular factory foundation':
      # Only replace its top material; all vertices and support faces stay exact.
      o.data.materials[0]=floorwarm;changed.append(o.name)
     if 'shallow domed lid' in o.name:assign(o,silver)
     if o.name=='bottling works folded blue roof':assign(o,roofblue)
     if o.name.startswith(('bottling standing roof seam','bottling rear roof seam')):assign(o,roofroll)
    # Open front workshop bay: real rear and side surfaces instead of a solid blue box.
    group='bottling_workshop'
    remove_matching(lambda o:o.name=='bottling works blue body' or o.name.startswith(('bottling works warm glazing','bottling works window center')))
    cube('inset rear lining',(-3.5,2.99,1.95),(3.56,.21,1.73),warmwall,.035)
    for x in [-5.22,-1.78]:cube('deep blue sidewall',(x,2.02,1.94),(.18,1.89,1.72),blue,.03)
    cube('factory shadow ceiling',(-3.5,1.75,2.72),(3.36,1.35,.10),interiordark,.012)
    cube('inset machine backboard',(-3.5,1.17,2.015),(3.24,.11,1.16),warmwall,.022)
    cube('inner bottle line shelf',(-3.61,1.13,1.57),(2.91,.55,.11),dark,.026)
    for x in [-4.78,-2.23]:
     cube('square enamel machine jamb',(x,1.02,1.95),(.13,.19,1.20),blue,.028)
     cube('jamb ivory fixing',(x,.918,2.12),(.15,.03,.12),silver,.018)
     for z in [1.54,2.43]:ico('machine jamb brass bolt',(x,.89,z),(.037,.015,.037),copperhi)
    # Continuous header and fittings explain the five bottle filling heads.
    beam('interior filling manifold',(-4.7,1.00,2.40),(-2.5,1.00,2.40),.082,copper,16)
    for x in [-4.42,-4.03,-3.64,-3.25,-2.86]:
     beam('filler downpipe',(x,1,2.41),(x,.82,2.11),.030,silver)
     torus('filler attachment ring',(x,1,2.40),.088,.019,copperhi,(math.pi/2,0,0))
    for x in [-4.41,-3.23]:
     cube('warm machine inspection light',(x,.98,2.57),(.51,.11,.085),window,.025)
     cube('inspection light metal cap',(x,.98,2.635),(.59,.16,.055),blue,.014)
    # Retain every original bottle center but give it an actual shoulder, neck and seal.
    for o in list(scene.objects):
     if o.name.startswith('filled juice bottle'):
      x=o.location.x;y=o.location.y
      bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=1,location=(x,y,1.917));ob=bpy.context.object;ob.name='bottle rounded shoulder';ob.scale=(.093,.093,.066);ns['assign'](ob,purple);tag(ob)
      cyl('bottle narrow neck',(x,y,1.972),.045,.072,lilac,16)
      cube('bottle ivory product label',(x,y-.094,1.76),(.105,.014,.135),cream,.015)
      ico('label violet seal',(x,y-.108,1.775),(.024,.007,.035),purple)
    # Machine fascia reads as alternating safety blocks without occupying lane space.
    for i in range(10):
     cube('small conveyor hazard enamel',(-4.64+i*.228,.572,1.335),(.126,.026,.090),cream if i%2 else ns['yellow'],.006,rot=0)
    # Side electrical cabinet is inside the existing bay footprint, behind the lane.
    cube('supply electric cabinet',(-5.45,1.42,1.84),(.35,.53,.86),blue,.055)
    cube('cabinet front inset',(-5.45,1.141,1.86),(.25,.024,.62),edge,.017)
    for z,m in [(2.03,ns['lime']),(1.82,coral)]:cyl('cabinet indicator',(-5.48,1.119,z),.045,.020,m,16).rotation_euler.x=math.pi/2
    curve('cabinet anchored conduit',[(-5.45,1.43,2.25),(-5.45,1.43,2.69),(-5.12,1.43,2.69)],.032,dark)
    # The receiving bay gets a single compact slatted box behind the stage corridor.
    cube('receiving crate inset',(-5.82,2.06,1.30),(.49,.44,.48),wood,.025)
    for z in [1.11,1.26,1.41,1.54]:cube('receiving crate front slat',(-5.82,1.82,z),(.54,.045,.10),woodhi,.012)
    for x in [-6.04,-5.60]:cube('receiving crate corner',(x,1.80,1.32),(.065,.055,.52),cream,.008)
    beam('receiving crate diagonal',(-6.00,1.77,1.12),(-5.66,1.77,1.51),.027,woodhi,8)
    # Pipes remain at their approved height/centers, but supports have gussets and collars.
    group='anchored_pipework'
    for x,z in [(-4.60,3.62),(-2.25,3.88)]:
     beam('header structural diagonal',(x-.27,3.23,2.91),(x,3.23,z-.10),.038,blue)
     cube('header foot anchoring plate',(x,3.25,2.89),(.36,.32,.09),dark,.019)
     for xx in [-.115,.115]:ico('header plate bolt',(x+xx,3.16,2.95),(.034,.034,.022),silver)
    for x,y,z,axis in [(-3.9,3.2,3.88,'X'),(-2.55,3.2,3.88,'X'),(-1.85,3.2,4.45,'Z'),(-.94,3.2,5.07,'X')]:
     for j in range(6):
      a=j*math.tau/6
      p=(x-.068,y+math.cos(a)*.13,z+math.sin(a)*.13) if axis=='X' else (x+math.cos(a)*.13,y+math.sin(a)*.13,z+.075)
      ico('flange fastening',p,(.026,.026,.026),silver)
    for x in [-3.36]:
     for dx in [-.15,.15]:beam('roof header trestle leg',(x+dx,3.2,3.02),(x+dx,3.2,3.86),.035,blue)
     beam('roof header trestle top',(x-.20,3.2,3.83),(x+.20,3.2,3.83),.045,blue)
     beam('roof trestle diagonal',(x-.15,3.2,3.10),(x+.15,3.2,3.78),.023,blue)
    # Visible anchored process connection links the side of the small vessel to the line.
    curve('mixing to filling copper feed',[(-1.57,1.32,2.57),(-1.92,1.32,2.57),(-2.08,1.32,2.41),(-2.51,1.05,2.41)],.065,copper)
    for x,y,z in [(-1.89,1.32,2.57),(-2.3,1.15,2.41)]:torus('feed flange',(x,y,z),.09,.025,copperhi,(0,math.pi/2,0))
    # Shallow terracotta seam roof separates quality control from the production hall.
    group='inspection_office'
    remove_matching(lambda o:o.name=='quality control dark flat roof')
    booth=bpy.data.objects['quality control cream booth'];booth.dimensions.x=2.66;booth.location.x-=.12;changed.append(booth.name)
    x,y=3.75,3.12;xl,xr=2.20,5.02;yf,yb=2.44,3.80;ze,zr=3.70,4.00
    mesh('warm roof planes',[(xl,yf,ze),(xr,yf,ze),(xr,3.12,zr),(xl,3.12,zr),(xl,yb,ze),(xr,yb,ze)],[(0,1,2,3),(3,2,5,4)],terracotta)
    for i in range(14):
     xx=xl+.06+i*(xr-xl-.12)/13
     beam('raised terracotta front seam',(xx,yf,ze+.015),(xx,3.12,zr+.015),.029,terracottahi)
     beam('raised terracotta rear seam',(xx,3.12,zr+.015),(xx,yb,ze+.015),.029,terracottahi)
    for yy in [yf,yb]:beam('blue roof edge',(xl,yy,ze-.03),(xr,yy,ze-.03),.052,blue)
    beam('round roof ridge',(xl-.02,3.12,zr+.035),(xr+.02,3.12,zr+.035),.048,terracottahi)
    for o in list(scene.objects):
     if o.name.startswith('quality roof fan'):o.location.z+=.23;changed.append(o.name)
     if o.name=='quality control panoramic window':assign(o,window)
    # Three sample stations behind warm glazing, plus a small external bottle rack.
    for x in [2.80,3.35,3.90]:
     cyl('inspection sample bottle',(x,2.443,2.93),.048,.20,purple,16)
     cyl('sample cream stopper',(x,2.443,3.044),.031,.031,cream,12)
     cube('sample report card',(x+.12,2.452,2.94),(.095,.022,.18),cream,.006)
    for x in [2.42,4.82]:
     cube('quality warm hooded wall light',(x,2.44,3.26),(.12,.14,.23),window,.018)
     cube('quality lamp top cap',(x,2.44,3.39),(.17,.18,.045),blue,.012)
    # Ease the quality booth west within its original raised court. This releases
    # the outer Serra-departure silhouette without moving any route or paving.
    for o in list(scene.objects):
        if (o.name.startswith(('quality ','inspection bench','instrument lime status')) and not o.name.startswith(('quality access','quality terrace'))) or o.get('factory_enrichment_group')=='inspection_office':
            o.location.x-=.24
            if o.name not in changed:changed.append(o.name)
    # Foliage uses folded lance leaves in the Costa vocabulary, not loose green balls.
    def plant(x,y,z,s=1,seed=0):
     rng=random.Random(seed)
     for j in range(8):
      a=j*math.tau/8+rng.uniform(-.2,.2);reach=s*rng.uniform(.34,.60);h=s*rng.uniform(.35,.65);d=Vector((math.cos(a),math.sin(a),0));side=Vector((-d.y,d.x,0));p=Vector((x,y,z));mid=p+d*reach*.50+Vector((0,0,h));end=p+d*reach+Vector((0,0,h*.55));w=s*.10
      mesh('folded coastal frond',[tuple(p),tuple(mid-side*w),tuple(mid+Vector((0,0,.045*s))),tuple(mid+side*w),tuple(end)],[(0,1,2),(0,2,3),(1,4,2),(2,4,3)],[leaf,green2,green3][j%3])
    # Compact rear planting gives the factory a green edge without touching east Serra ingress.
    group='rooted_coastal_garden'
    for i,(x,y,z,s) in enumerate([(-6.05,2.45,1.045,1.35),(-5.80,3.18,1.05,1.05),(-6.52,.85,1.04,.75),(-2.35,4.15,1.03,.85),(-1.56,4.34,1.035,.82),(1.38,3.72,1.10,.55),(-3.83,-3.36,1.045,.43),(5.75,-2.94,1.04,.56),(1.76,.63,1.045,.69),(6.18,-2.54,1.045,.56)]):
     plant(x,y,z,s,331+i)
     ico('plant root stone',(x+.15,y+.06,z+.04),(.22*s,.19*s,.09*s),rockwarm)
    # A low rooted coastal fan lifts the unused rear-west corner into the silhouette.
    beam('short coastal fan trunk',(-6.00,2.65,1.03),(-6.08,2.65,2.05),.075,wood,10)
    plant(-6.08,2.65,2.00,1.28,774)
    # Sparse flat wear islands and chips live below the untouched elevated lane.
    group='yard_surface'
    wear=material('washed concrete patch',(.68,.68,.58));chip=material('small sandy aggregate',(.77,.74,.63))
    rng=random.Random(3481)
    for x,y,sx,sy in [(-4.38,-1.09,.33,.28),(-3.25,-.72,.19,.25),(-3.85,-2.31,.24,.19),(-1.47,-2.81,.33,.16),(.17,-2.84,.34,.19),(1.45,-2.85,.20,.24),(2.25,-2.91,.25,.15),(3.43,-2.74,.22,.20),(-1.58,-.36,.26,.23),(2.00,.12,.23,.20),(3.11,-.62,.30,.23),(4.11,-.31,.21,.21),(6.21,-1.72,.19,.28),(-6.26,.13,.24,.20)]:
     pts=[(x+sx*math.cos(a)*rng.uniform(.78,1.15),y+sy*math.sin(a)*rng.uniform(.75,1.12),1.046) for a in [j*math.tau/7 for j in range(7)]]
     mesh('irregular flush yard wash',pts,[tuple(range(7))],wear)
     for j in range(3):
      xx=x+rng.uniform(-.4,.4);yy=y+rng.uniform(-.35,.35)
      ico('flush ground aggregate',(xx,yy,1.056),(.025,.022,.012),chip if j%2 else stone)
    # Split shoreline rocks remain entirely below the walkway and skip the bridge entrance.
    group='coastal_foundation'
    rng=random.Random(921)
    # A coordinated rhythm of medium rocks, not a complete regular necklace.
    rock_places=[
        (-6.90,1.73,.51,.46),(-7.02,1.18,.28,.29),(-6.88,2.12,.30,.25),
        # Three loose frontal groups; exposed gaps are intentional.
        (-3.64,-3.70,.32,.29),(-3.12,-3.88,.66,.43),(-2.53,-3.82,.31,.26),
        (-.20,-3.96,.74,.46),(.51,-3.87,.40,.36),(.83,-3.74,.23,.23),
        (4.31,-3.70,.73,.48),(4.99,-3.50,.40,.34),(5.44,-3.25,.28,.25),
        (6.91,-1.70,.43,.34),(-5.33,3.79,.49,.40),(-3.72,4.07,.40,.37),(-.30,4.38,.39,.32)]
    for i,(x,y,sx,sy) in enumerate(rock_places):
     z=.23+rng.random()*.10;h=.35+rng.random()*.17
     o=ico('water worn bedrock',(x,y,.08),(sx*1.05,sy*1.12,.24),wetstone);o.rotation_euler.z=rng.random()*math.tau
     o=ico('fractured shoreline rock',(x,y,z),(sx,sy,h),rockwarm if i%3 else rocklight);o.rotation_euler.z=rng.random()*math.tau
     o=ico('small attached shore flake',(x+sx*.58,y-sy*.45,.17),(sx*.54,sy*.49,.25),stone);o.rotation_euler.z=rng.random()*math.tau
    # Broken shallow strokes follow each whole outcrop, never individual rings.
    for points in [
        [(-3.81,-3.87,.022),(-3.56,-4.10,.022),(-3.12,-4.26,.022),(-2.88,-4.25,.022)],
        [(-2.70,-4.18,.022),(-2.45,-4.01,.022)],
        [(-.88,-4.07,.022),(-.65,-4.36,.022),(-.18,-4.46,.022),(.12,-4.43,.022)],
        [(.35,-4.30,.022),(.73,-4.16,.022),(.91,-3.99,.022)],
        [(3.60,-3.82,.022),(3.83,-4.12,.022),(4.31,-4.21,.022),(4.57,-4.14,.022)],
        [(4.83,-4.0,.022),(5.14,-3.86,.022)]]:
        curve('broken outcrop water contact',points,.010,foam)
    # Thin moss strata and hanging leaves sit against masonry rather than over player feet.
    group='masonry_weathering'
    for i,(a,b) in enumerate(zip(ns['outline'],ns['outline'][1:]+ns['outline'][:1])):
     a,b=Vector((*a,0)),Vector((*b,0));d=b-a;normal=Vector((d.y,-d.x,0)).normalized();L=d.length;theta=math.atan2(d.y,d.x)
     if i in [0,16,17]:continue # keep bridge and service arrival unmistakable
     for t in [.18,.71]:
      p=a.lerp(b,t)+normal*.105
      cube('dark tide mortar patch',(p.x,p.y,.31),(min(L*.25,.53),.016,.09),moss,.019,theta)
     if i in [2,4,6,12,14]:
      p=a.lerp(b,.40)+normal*.13
      for j in range(3):
       q=p+d.normalized()*math.sin(j)*.10
       ico('masonry hanging salt leaf',(q.x,q.y,.73-j*.16),(.12,.11,.14),leaf if j%2 else moss)
    # Low functional mooring fenders stay outside route billboard volumes.
    group='quay_details'
    for x,y in [(-2.48,-3.71),(.61,-3.78),(3.56,-3.66)]:
     beam('retaining wall timber tie',(x,y,.18),(x,y,1.05),.078,wood,12)
     torus('quay rope lashing',(x,y,0.93),.084,.015,rope)
     torus('small rubber wall fender',(x,y-.10,.48),.16,.047,dark,(math.pi/2,0,0))
    # Timber stock is richer at the same approved locations; no new crates in circulation.
    group='receiving_stock'
    for o in list(scene.objects):
     if o.name.startswith(('receiving pallet','receiving timber pallet')):
      x,y,z=o.location
      for dy in [-.17,.0,.17]:cube('pallet separate slat',(x,y+dy,z+.083),(o.dimensions.x+.015,.09,.025),woodhi,.007)
    for x,y,z in [(-6.28,-1.50,1.54),(-6.28,-.80,1.54),(-5.7,2.85,1.54)]:
     mesh('barrel original droplet seal',[(x,y-.255,z+.15),(x-.055,y-.255,z+.015),(x-.045,y-.255,z-.055),(x,y-.255,z-.085),(x+.045,y-.255,z-.055),(x+.055,y-.255,z+.015)],[(0,1,2,3,4,5)],cream)
    # Save a compact provenance and keep all walk surfaces/camera/light fingerprints exact.
    bpy.context.view_layer.update()
    walk_after={o.name:geometry_record(o) for o in scene.objects if o.name.startswith(('walk_','quality access','quality terrace','maintenance'))}
    light_after={o.name:{'position':list(o.location),'rotation':list(o.rotation_euler),'power':o.data.energy,'color':list(o.data.color),'size':o.data.size} for o in scene.objects if o.type=='LIGHT'}
    assert walk_before==walk_after,'Walking geometry changed';assert light_before==light_after,'Lighting changed'
    report={'cameraUnchanged':all(meta[k]==baseline[k] for k in ['camera','nodes','routes','secretRoute','worldRoutes','size']),'walkGeometryExact':walk_before==walk_after,'lightingExact':light_before==light_after,'renderSettings':{'samples':scene.cycles.samples,'percentage':scene.render.resolution_percentage,'engine':scene.render.engine,'look':scene.view_settings.look,'exposure':scene.view_settings.exposure},'addedObjects':len([o for o in scene.objects if 'factory_enrichment_group' in o]),'removedObjects':removed,'changedBaseObjects':changed,'groups':{g:len([o for o in scene.objects if o.get('factory_enrichment_group')==g]) for g in sorted(set(o.get('factory_enrichment_group') for o in scene.objects if 'factory_enrichment_group' in o))}}
    return report
