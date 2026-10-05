"""Eroded limestone, pocket beaches and falling citrus water for island revision 4.

All detail is editable Blender geometry. The same height field places buildings,
carves the river and locates the actual waterline; no separate decorative rim.
"""
import math
import random
from functools import lru_cache

import bpy
from mathutils import Vector, noise

import island_geometry as G

PADS = [(-14,-10.9,8.8,5.9,2.6),(-20,-3.7,3.2,3,4.0),
        (12,10,6.5,5.0,11.6),(13,-.6,5.6,3.9,6.1),
        (16,-9,5.5,4.1,3.6),(-.6,8.9,4.6,3.8,7.0),
        (7.2,2.6,2.9,2.7,7.1),(-20,10,3.2,2.5,6.4)]
FALLS = [(1.12,.26,5.95,2.34),(-7.55,-8.40,2.23,.22)]


def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)))
    return t*t*(3-2*t)


def beach_weight(a):
    def cove(center,width):
        delta=math.atan2(math.sin(a-center),math.cos(a-center))
        return math.exp(-(delta/width)**4)
    return max(cove(-.55,.38),cove(-2.02,.28)*.92,
               cove(-2.73,.19)*.8,cove(1.65,.30)*.85)


def boundary(a):
    return (1+.055*math.sin(3*a+.2)+.038*math.sin(7*a-1.2)
            +.018*math.cos(13*a)+.004*math.sin(23*a)-.015*beach_weight(a))


def radius(x,y):
    a=math.atan2(y/22,x/30)
    return math.hypot(x/30,y/22)/boundary(a)


def river_x(y):
    return 1.3*math.sin(y*.19)-.4+.45*math.sin((y+9)*.48)*(1-smooth(-12,-8,y))


def river_width(y):
    w=1.52+.18*math.sin(y*.72)+.13*math.sin(y*1.43+.5)
    w+=.88*math.exp(-((y+1.15)/1.55)**2)+.56*math.exp(-((y+9.8)/1.8)**2)
    w+=.40*math.exp(-((y-3.2)/2.3)**2)+1.05*(1-smooth(-23,-18,y))
    return w


def water_z(y):
    for lip,foot,top,bottom in FALLS:
        if foot<y<lip:
            t=(lip-y)/(lip-foot)
            return top-(top-bottom)*t**1.8
    if y>=1.12:return 5.95+.018*(y-1.12)
    if y>=-7.55:return 2.23+.0141*(y+7.55)
    return .018+.202*smooth(-22,-8.4,y)


def fall_amount(y):
    for lip,foot,_,_ in FALLS:
        if foot<y<lip:return math.sin(math.pi*(lip-y)/(lip-foot))**.35
    return 0


def height(x,y):
    r=radius(x,y)
    if r>=1.045:return -1.15
    a=math.atan2(y/22,x/30)
    h=2.9+4.2*math.exp(-(((x+13)/14)**2+((y-4)/13)**2))
    h+=9*math.exp(-(((x-12)/12)**2+((y-10)/11)**2))
    h+=1.6*math.exp(-(((x-14)/8)**2+((y+10)/8)**2))
    h+=noise.fractal(Vector((x*.22,y*.22,3.4)),.8,2,3)*.38
    h+=noise.noise(Vector((x*.95,y*.95,6)))*.065
    for px,py,rx,ry,level in PADS:
        d=(abs((x-px)/rx)**4+abs((y-py)/ry)**4)**.25
        blend=smooth(.75,1.2,d)
        h=h*blend+level*(1-blend)
    # Sheltered coves have a gently sloping sand shelf below the grassy scarp.
    coast=-1.15+(h+1.15)*smooth(1.035,.845,r)
    sand=-.32+.91*(1-smooth(.85,1.037,r))+1.18*(1-smooth(.78,.89,r))
    sand+=.045*math.sin(a*32+r*43)*smooth(.98,.84,r)
    cove=beach_weight(a)*smooth(.745,.835,r)
    h=coast*(1-cove)+sand*cove
    # Carve AFTER the coast, so the estuary reaches sea level without a raised lip.
    if y<7.3:
        w=river_width(y)
        d=abs(x-river_x(y))
        blend=(1-smooth(w+.12,w+1.75,d))*(1-smooth(5.7,7.3,y))
        blend*=1-smooth(.982,1.035,r)
        bed=water_z(y)-.28+.32*smooth(.64,1.035,d/w)
        # Undercut the falling sheet: a waterfall has air behind its face.
        bed-=.18*fall_amount(y)
        h=h*(1-blend)+bed*blend
    return h


def vertex_material(name,attribute,color,roughness):
    mat=G.material(name,color,roughness)
    nodes=mat.node_tree.nodes
    attr=nodes.new('ShaderNodeVertexColor');attr.layer_name=attribute
    shader=nodes.get('Principled BSDF')
    mat.node_tree.links.new(attr.outputs['Color'],shader.inputs['Base Color'])
    mat.node_tree.links.new(attr.outputs['Alpha'],shader.inputs['Alpha'])
    return mat,shader


def tint_mesh(obj,name,colors):
    attr=obj.data.color_attributes.new(name=name,type='FLOAT_COLOR',domain='POINT')
    for item,color in zip(attr.data,colors):item.color=color
    obj.data.color_attributes.active_color=attr


def build_terrain():
    segments=384;rings=204
    verts=[(0,0,height(0,0))]
    for j in range(1,rings+1):
        r=j/rings*1.04
        for i in range(segments):
            a=i*math.tau/segments
            x=30*math.cos(a)*r*boundary(a);y=22*math.sin(a)*r*boundary(a)
            verts.append((x,y,height(x,y)))
    faces=[(0,1+i,1+(i+1)%segments) for i in range(segments)]
    for j in range(rings-1):
        lo=1+j*segments;hi=lo+segments
        for i in range(segments):
            n=(i+1)%segments
            faces.append((lo+i,hi+i,hi+n,lo+n))
    bottom=len(verts);verts.append((0,0,-1.4))
    faces.extend((bottom,1+(rings-1)*segments+(i+1)%segments,1+(rings-1)*segments+i) for i in range(segments))
    mat,shader=vertex_material('Eroded limestone, meadow and intertidal sand','TerrainTint','#B9B494',.91)
    nodes=mat.node_tree.nodes;links=mat.node_tree.links
    pos=nodes.new('ShaderNodeNewGeometry')
    grain=nodes.new('ShaderNodeTexNoise');grain.inputs['Scale'].default_value=6.0
    grain.inputs['Detail'].default_value=3
    bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.19;bump.inputs['Distance'].default_value=.065
    links.new(pos.outputs['Position'],grain.inputs['Vector']);links.new(grain.outputs['Fac'],bump.inputs['Height'])
    links.new(bump.outputs['Normal'],shader.inputs['Normal'])
    obj=G.mesh('Continuous landmass with eroded coves and incised river',verts,faces,mat,smooth=True)
    obj.data.update()
    stone=Vector(G.linear('#BFB097'));turf=Vector(G.linear('#81925C'))
    dry=Vector(G.linear('#EBD09D'));wet=Vector(G.linear('#B6AA87'))
    colors=[]
    for vertex in obj.data.vertices:
        x,y,z=vertex.co;a=math.atan2(y/22,x/30);r=radius(x,y)
        slope=smooth(.68,.95,vertex.normal.z)
        bank=(1-smooth(river_width(y),river_width(y)+1.5,abs(x-river_x(y))))*(1-smooth(5.7,7.3,y))
        slope*=1-.86*bank
        mottling=noise.noise(Vector((x*.37,y*.37,z*.24)))
        strata=noise.noise(Vector((x*.28,y*.28,z*5.3)))
        color=(stone*(1+strata*.10)*(1-slope)+turf*slope)*(1+mottling*.13)
        sandy=max((1-smooth(.18,.75,z)),beach_weight(a)*smooth(.77,.85,r)*(1-smooth(1.1,2.0,z)))
        sand=wet.lerp(dry,smooth(-.02,.48,z))*(1+mottling*.035)
        color=color.lerp(sand,sandy)
        colors.append((*color,smooth(-.16,.025,z)))
    tint_mesh(obj,'TerrainTint',colors)
    obj['landform']='Continuous smooth terrain; sheltered sand shelves; undercut falls; fading submerged sand'
    return obj


def rock_materials():
    for name,color in [('strata-dry','#BDB39E'),('strata-warm','#C9B99F'),
                       ('strata-dark','#999787'),('strata-wet','#778477')]:
        mat=G.material(name,color,.86 if name!='strata-wet' else .36,0,.04)
        nodes=mat.node_tree.nodes;links=mat.node_tree.links
        tex=next(n for n in nodes if n.type=='TEX_NOISE')
        coord=nodes.new('ShaderNodeTexCoord');stretch=nodes.new('ShaderNodeVectorMath');stretch.operation='MULTIPLY'
        stretch.inputs[1].default_value=(2.3,2.3,15)
        links.new(coord.outputs['Generated'],stretch.inputs[0]);links.new(stretch.outputs['Vector'],tex.inputs['Vector'])
        tex.inputs['Scale'].default_value=1.7;tex.inputs['Detail'].default_value=2
        ramp=nodes.new('ShaderNodeValToRGB')
        rgb=Vector(G.linear(color))
        ramp.color_ramp.elements[0].position=.21;ramp.color_ramp.elements[0].color=(*(rgb*.78),1)
        ramp.color_ramp.elements[1].position=.79;ramp.color_ramp.elements[1].color=(*(rgb*1.08),1)
        links.new(tex.outputs['Fac'],ramp.inputs['Fac']);links.new(ramp.outputs['Color'],nodes['Principled BSDF'].inputs['Base Color'])
    G.material('coastal-grass','#8E9765',.94)
    G.material('sea-foam','#D6E5CC',.48)
    G.material('juice-foam','#FFE5AC',.36)
    G.material('juice-glint','#FFD081',.19)


def rock(name,p,scale,seed,wet=False):
    """Bedded limestone blocks with worn corners, not triangulated icospheres."""
    rr=random.Random(seed);n=16;verts=[];faces=[]
    phase=rr.uniform(0,6.28)
    for k,(z,r) in enumerate([(-1,.65),(-.76,.96),(-.27,1),(.35,.94),(.74,.76),(1,.38)]):
        dx=.10*math.sin(k*.8+phase);dy=.08*math.cos(k+phase)
        for i in range(n):
            a=i*math.tau/n
            undulation=1+.09*math.sin(a*3+phase)+.035*math.cos(a*5-phase+k*.3)
            xx=math.copysign(abs(math.cos(a))**.72,math.cos(a))
            yy=math.copysign(abs(math.sin(a))**.72,math.sin(a))
            verts.append(((xx*r*undulation+dx)*scale[0],(yy*r*undulation+dy)*scale[1],
                          (z+.075*math.sin(a*2+phase))*scale[2]))
        if k:
            for i in range(n):
                q=(i+1)%n;faces.append(((k-1)*n+i,(k-1)*n+q,k*n+q,k*n+i))
    faces.extend([tuple(reversed(range(n))),tuple(5*n+i for i in range(n))])
    obj=G.mesh(name,verts,faces,'strata-wet' if wet else ['strata-dry','strata-warm','strata-dark'][seed%3],p,smooth=False)
    obj.rotation_euler=(rr.uniform(-.13,.13),rr.uniform(-.13,.13),rr.uniform(-math.pi,math.pi))
    bevel=obj.modifiers.new('Water-worn limestone edges','BEVEL');bevel.width=.065;bevel.segments=3
    normals=obj.modifiers.new('Broad fracture plane normals','WEIGHTED_NORMAL');normals.keep_sharp=True
    obj['geology']='Bedded limestone, embedded foundation, weathered horizontal planes'
    return obj


def build_outcrops():
    rock_materials();rr=random.Random(41107)
    # Headlands alternate with open beaches. Each formation shares an orientation
    # and diminishes into small talus instead of repeating around the perimeter.
    for cluster,a in enumerate([-.04,-1.04,-1.31,-2.39,2.82,2.36,1.15,.68]):
        for j,(da,r) in enumerate([(-.04,.912),(0,.938),(.036,.966),(.069,.931),(-.071,.979),(-.020,.976)]):
            aa=a+da+rr.uniform(-.009,.009)
            x=30*math.cos(aa)*boundary(aa)*r;y=22*math.sin(aa)*boundary(aa)*r
            if y<-7 and abs(x)<5:continue
            z=height(x,y);size=rr.uniform(.75,1.22) if j in (0,3) else rr.uniform(.38,.73)
            # Roots extend to the tide line. These are fragments of the cliff,
            # not boulders perched halfway down its slope.
            tall=max(.38,z*.57)
            obj=rock('Embedded limestone headland',(x,y,max(.05,z*.44)),(size*1.30,size*.87,tall),cluster*31+j)
            obj.rotation_euler.z=a+rr.uniform(-.15,.15)
        if cluster%2==0:
            inland_r=.868;x=30*math.cos(a)*boundary(a)*inland_r;y=22*math.sin(a)*boundary(a)*inland_r
            G.organic('Wind-clipped vegetation behind the headland',(x,y,height(x,y)+.08),
                      (.65,.48,.16),'leaf2',cluster*17,.19,2)
        # Low detached rocks share the parent formation and are sunk in the water.
        for j in range(3):
            aa=a+rr.uniform(-.10,.10);r=shore_radius(aa)+rr.uniform(.006,.026)
            x=30*math.cos(aa)*boundary(aa)*r;y=22*math.sin(aa)*boundary(aa)*r
            s=rr.uniform(.18,.49)
            rock('Partly submerged tidal stone',(x,y,-s*.36),(s*1.3,s*.8,s*.55),cluster*11+j,True)
    # Asymmetric ledges belong to the gorge wall. Leave long stretches exposed.
    for side in (-1,1):
        for j,y in enumerate([-17.2,-15.1,-11.1,-9.6,-7.7,-4.8,-1.0,.9,3.7,5.2]):
            x=river_x(y)+side*(river_width(y)+.83)
            z=height(x,y);s=rr.uniform(.55,.88)
            o=rock('Exposed bedded riverbank',(x,y,z-.22),(s*.86,s*1.25,s*.62),290+j+side*19)
            o.rotation_euler.z=rr.uniform(-.16,.16)
            if j%3==0:
                G.organic('Riverbank creeping groundcover',(x+side*.12,y,z+.19),(.50,.72,.12),'leaf1',j,.15,2)
    # The two drop lips are anchored by broad, partly buried bedrock shoulders.
    for f,(lip,foot,top,bottom) in enumerate(FALLS):
        for side in (-1,1):
            for j in range(3):
                y=lip+.38-j*.42;x=river_x(y)+side*(river_width(y)+.28+j*.18)
                z=height(x,y)
                o=rock('Waterfall limestone abutment',(x,y,z-.21),(.75,.78,.38),700+f*20+j+side*4)
                o.rotation_euler.z=.1*side


def river_point(y,u):
    w=river_width(y)*(1+.035*math.sin(y*2.4+u*2.6))
    x=river_x(y)+u*w
    local_y=y+.025*math.sin(u*11+.4)+.015*math.sin(u*23)
    falling=fall_amount(local_y)
    ripple=(.013*math.sin(y*5+x*2)+.007*math.sin(x*8-y*3))*(1-falling)
    ridge=falling*(.022*math.sin(u*37+y*1.6)+.013*math.sin(u*81-y*3))
    return (x,y,water_z(local_y)+.035+ripple+ridge)


def flow_ribbon(name,y0,y1,u,width,mat,phase=0):
    verts=[];faces=[]
    for j in range(24):
        t=j/23;y=y0+(y1-y0)*t
        center=u+.012*math.sin(t*7+phase)
        taper=math.sin(math.pi*t)**.65
        for side in (-1,1):
            x,yy,z=river_point(y,center+side*width*taper)
            verts.append((x,yy,z+.015))
        if j:faces.append((j*2-2,j*2,j*2+1,j*2-1))
    return G.mesh(name,verts,faces,mat,smooth=True)


def build_river():
    rr=random.Random(42019)
    mat,shader=vertex_material('Fresh orange juice, rippled surface','RiverTint','#EAA03D',.17)
    shader.inputs['IOR'].default_value=1.333
    shader.inputs['Coat Weight'].default_value=.32
    shader.inputs['Coat Roughness'].default_value=.13
    shader.inputs['Subsurface Weight'].default_value=.035
    # A dense continuous sheet curls across the lips; height samples cluster at
    # the drops so the silhouettes remain curved even at the master resolution.
    ys=sorted(set([-24.4+i*31.8/470 for i in range(471)]+
                  [foot+(lip-foot)*i/82 for lip,foot,_,_ in FALLS for i in range(83)]))
    cols=80;verts=[];faces=[];colors=[]
    dark=Vector(G.linear('#D47B23'));light=Vector(G.linear('#F6B349'))
    sea=Vector(G.linear('#568E7D'))
    for row,y in enumerate(ys):
        falling=fall_amount(y)
        for j in range(cols+1):
            u=j/cols*2-1;x,yy,z=river_point(y,u);verts.append((x,yy,z))
            variation=.27+.30*abs(u)+.10*math.sin(y*1.2+u*3)
            variation+=falling*(.26+.18*math.sin(u*43+.8*math.sin(y*3)))
            col=dark.lerp(light,min(1,max(0,variation)))
            col=sea.lerp(col,smooth(-23.5,-20.6,y))
            colors.append((*col,smooth(-24.4,-22.0,y)))
            if row and j:
                k=row*(cols+1)+j;faces.append((k-cols-2,k-cols-1,k,k-1))
    obj=G.mesh('Orange river with curling free falls and plunge pools',verts,faces,mat,smooth=True)
    tint_mesh(obj,'RiverTint',colors)
    obj['flow']='Two accelerating free falls; irregular channels; plunge pools; estuary mixing'
    for index,(lip,foot,top,bottom) in enumerate(FALLS):
        # Broken highlights have unequal lengths and widths; no parallel ropes.
        for j in range(29):
            u=rr.uniform(-.91,.91);start=lip+rr.uniform(-.10,.08)
            end=foot+rr.uniform(.02,.50)*(lip-foot)
            flow_ribbon('Aerated streak in falling juice',start,end,u,rr.uniform(.004,.017),
                        'juice-foam' if j%5==0 else 'juice-glint',j)
        # Froth spreads from the impact in connected, irregular patches.
        for j in range(58):
            y=foot-rr.uniform(.07,.80);u=rr.uniform(-.88,.88)
            x,yy,z=river_point(y,u)
            s=rr.uniform(.04,.13)*(1.15-abs(u)*.35)
            G.organic('Aerated foam at waterfall impact',(x,yy,z+.02),(s*1.8,s,.017),
                      'juice-foam',900+index*70+j,.28,2)
        for j in range(12):
            flow_ribbon('Foam carried downstream',foot-rr.uniform(.12,.7),foot-rr.uniform(.95,1.9),
                        rr.uniform(-.82,.82),rr.uniform(.004,.014),'juice-foam',j)
        for j in range(22):
            t=rr.random();x=river_x(foot)+rr.uniform(-1.3,1.3);y=foot-.15-rr.random()*.45
            z=bottom+.1+math.sin(t*math.pi)*rr.uniform(.07,.30)
            s=rr.uniform(.014,.035)
            G.organic('Small droplets above impact',(x,y,z),(s,s,s*1.65),'juice-glint',j,0,1)
    for j in range(52):
        y=rr.uniform(-21,5.8)
        if fall_amount(y)>.02:continue
        flow_ribbon('Quiet broken current highlight',y,y-rr.uniform(.15,.65),rr.uniform(-.85,.85),
                    rr.uniform(.002,.008),'juice-glint',j)


@lru_cache(maxsize=8192)
def shore_radius(a):
    lo=.76;hi=1.04
    for _ in range(17):
        r=(lo+hi)*.5;x=30*math.cos(a)*boundary(a)*r;y=22*math.sin(a)*boundary(a)*r
        if height(x,y)>.015:lo=r
        else:hi=r
    return (lo+hi)*.5


def shore_point(a,offset=0):
    r=shore_radius(a)+offset
    return (30*math.cos(a)*boundary(a)*r,22*math.sin(a)*boundary(a)*r,.012)


def build_shore():
    rr=random.Random(47116);n=384;rows=14;verts=[];faces=[];colors=[]
    mat,shader=vertex_material('Transparent intertidal water','ShoreTint','#5EACA2',.21)
    shader.inputs['IOR'].default_value=1.333
    shader.inputs['Coat Weight'].default_value=.24
    for j in range(rows):
        t=j/(rows-1)
        for i in range(n):
            a=i*math.tau/n
            offset=-.006+t*(.042+.011*math.sin(a*5)+.009*beach_weight(a))
            x,y,z=shore_point(a,offset);verts.append((x,y,z-.008))
            col=Vector(G.linear('#83B4A0')).lerp(Vector(G.linear('#39898D')),t)
            alpha=.62*(1-smooth(.1,1,t))*smooth(0,.10,t)
            # Let the orange river and its diluted estuary own the mouth.
            alpha*=smooth(2.0,3.4,abs(x-river_x(y))) if y<-19 else 1
            colors.append((*col,alpha))
            if j:
                q=(i+1)%n;faces.append(((j-1)*n+i,j*n+i,j*n+q,(j-1)*n+q))
    obj=G.mesh('Shallow sea following the actual tide line',verts,faces,mat,smooth=True)
    tint_mesh(obj,'ShoreTint',colors)
    # Thin curved wavelets break up on sheltered sand, and disappear in open sea.
    for a0 in [-.83,-.68,-.48,-.27,-2.18,-2.03,-1.89,-2.84,-2.69,1.48,1.69]:
        for wave in range(2):
            verts=[];faces=[];length=rr.uniform(.085,.16)
            for j in range(29):
                t=j/28;a=a0+length*(t-.5)
                center=.002+wave*.012+.0014*math.sin(t*9+a0)
                width=.0007*math.sin(math.pi*t)**.7*(1 if wave==0 else .65)
                for side in (-1,1):
                    x,y,z=shore_point(a,center+side*width);verts.append((x,y,z+.006))
                if j:faces.append((2*j-2,2*j,2*j+1,2*j-1))
            G.mesh('Broken wash on pocket beach',verts,faces,'sea-foam',smooth=True)
    # Dune vegetation stays above the wet sand. Pebbles are buried, not perched.
    blades=[];blade_faces=[]
    for j in range(270):
        a=rr.uniform(-math.pi,math.pi);r=rr.uniform(.832,.925)
        if beach_weight(a)<.6:continue
        x=30*math.cos(a)*boundary(a)*r;y=22*math.sin(a)*boundary(a)*r;z=height(x,y)
        if z<.48 or z>1.7:continue
        if j%7==0:
            rock('Small embedded beach pebble',(x,y,z-.035),(.14,.095,.065),j)
        for k in range(rr.randrange(3,7)):
            angle=rr.random()*math.tau;length=rr.uniform(.12,.31);i=len(blades)
            dx=math.cos(angle);dy=math.sin(angle)
            blades.extend([(x-dy*.018,y+dx*.018,z),(x+dy*.018,y-dx*.018,z),
                           (x+dx*.10,y+dy*.10,z+length)])
            blade_faces.append((i,i+1,i+2))
    G.mesh('Sparse grasses at the top of the sand',blades,blade_faces,'coastal-grass')
