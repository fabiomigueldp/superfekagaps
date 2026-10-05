"""Focused support, irrigation and crop-contact checks on a generated scene.

blender -b SCENE.blend -t 4 -P tools/diorama/guaira/audit_redesign_rice.py -- \
    --output REPORT.json

Checks actual evaluated Blender geometry. This is not browser, device/FPS or
full gameplay QA. It deliberately ignores planted leaves when testing a channel
for solid berm/wall obstructions, and does not pretend to simulate water flow.
"""
import argparse
from collections import Counter
import json
from pathlib import Path
import sys
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output',required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
scene=bpy.context.scene
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get()
core=bpy.data.objects['Continuous clay island']
ground=BVHTree.FromObject(core,deps)
owned=[o for o in scene.objects if o.get('guaira_rice_redesign') and o.type=='MESH']
soil=[o for o in owned if o.name.startswith('Connected ') and o.name.endswith(' earth terrace')]

# Sample outer sediment perimeters, canal beds, banks, and working apron against
# the continuous island, never against a detached decorative cliff panel.
points=[]
for ob in soil:
    vs=[ob.matrix_world@v.co for v in ob.data.vertices]
    lowest=min(v.z for v in vs)
    ring=[v for v in vs if abs(v.z-lowest)<.0001]
    for a,b in zip(ring,ring[1:]+ring[:1]):
        points.extend((ob.name,a.lerp(b,k/8)) for k in range(9))
for p in scene.get('guaira_rice_contact_points',[]):
    points.append(('authored contact',Vector(p)))
for ob in owned:
    if ('seated sediment bed' in ob.name or 'founded retaining lip' in ob.name
            or 'return bank' in ob.name or 'founded stone foot' in ob.name
            or ob.name.startswith(('Keeper compacted working bank','Keeper canal-side work path','Paddy bridge founded abutment'))):
        points.extend((ob.name,ob.matrix_world@v.co) for v in ob.data.vertices)
support=[]
for name,p in points:
    loc,normal,index,distance=ground.ray_cast(Vector((p.x,p.y,1.90)),Vector((0,0,-1)),.30)
    support.append({'object':name,'point':list(p),'supported':loc is not None and abs(loc.z-1.75)<.01,
                    'groundZ':loc.z if loc is not None else None})

# Both the buried floor and raised berms must be closed volumes, not top-only
# masks. Water planes and plant leaves intentionally remain open surfaces.
closed=[]
for ob in owned:
    if (ob in soil or 'compacted berm' in ob.name or 'seated sediment bed' in ob.name
            or 'founded retaining lip' in ob.name or 'return bank' in ob.name):
        counts=Counter(edge for polygon in ob.data.polygons for edge in polygon.edge_keys)
        closed.append({'object':ob.name,'closed':all(count==2 for count in counts.values()),
                       'nonManifoldEdges':sum(count!=2 for count in counts.values())})

# Sample wet ribbons at the centre and two interior lateral lines. Crop stems,
# deliberate sluice shutters and the deck over the contained culvert are not
# false-positive dams. Every other owned solid bank/floor is checked.
blocking=[o for o in owned if ('berm' in o.name or 'retaining lip' in o.name
            or 'return bank' in o.name or o.name.startswith('Connected '))]
bvhs=[(o.name,BVHTree.FromObject(o,deps)) for o in blocking]
channels=[]
for ob in owned:
    if 'flowing' not in ob.name:continue
    assert len(ob.data.vertices)==4, 'Water motion requires four-vertex channel ribbons'
    vs=[ob.matrix_world@v.co for v in ob.data.vertices]
    a,b=(vs[0]+vs[1])/2,(vs[2]+vs[3])/2
    side=(vs[1]-vs[0])*.32
    blocked=[]
    for step in range(1,20):
        for lateral in (-1,0,1):
            point=a.lerp(b,step/20)+side*lateral
            hits=[]
            for name,bvh in bvhs:
                loc,normal,index,distance=bvh.ray_cast(point+Vector((0,0,.24)),Vector((0,0,-1)),.5)
                if loc is not None and loc.z>point.z+.003:
                    hits.append({'object':name,'z':loc.z})
            if hits:blocked.append({'fraction':step/20,'lateral':lateral,'point':list(point),'hits':hits})
    channels.append({'name':ob.name,'sampleCount':57,'blockedSamples':blocked})

paddies={o.name:sorted(set(round((o.matrix_world@v.co).z,4) for v in o.data.vertices))
         for o in owned if 'cyan irrigated paddy' in o.name}
roots=[]
for ob in owned:
    if 'planted_roots' not in ob:continue
    bed=bpy.data.objects['Connected '+ob['rice_bed_name']+' earth terrace']
    bed_bvh=BVHTree.FromObject(bed,deps)
    for p in ob['planted_roots']:
        point=Vector(p)
        loc,normal,index,distance=bed_bvh.ray_cast(point+Vector((0,0,.05)),Vector((0,0,-1)),.10)
        roots.append({'bed':ob['rice_bed_name'],'point':list(point),
                      'rooted':loc is not None and abs(loc.z-point.z)<.0001})

# Continuous outside lips plus the two returns contain the east-spine elbows.
# Probe the wall itself from above, outside the wet ribbon, at close intervals.
containment=[]
wall_bvhs=[(o.name,BVHTree.FromObject(o,deps)) for o in owned
           if 'founded retaining lip' in o.name or 'return bank' in o.name]
for label,positions in (
    ('east outside wall',[(6.16,-.92-step*(3.16/40)) for step in range(41)]),
    ('north corner return',[(5.75+step*.04,-.87) for step in range(12)]),
    ('south corner return',[(5.75+step*.04,-4.145) for step in range(12)])):
    for x,y in positions:
        hits=[]
        for name,bvh in wall_bvhs:
            loc,normal,index,distance=bvh.ray_cast(Vector((x,y,1.95)),Vector((0,0,-1)),.25)
            if loc is not None and loc.z>1.84:hits.append(name)
        containment.append({'section':label,'point':[x,y],'retained':bool(hits)})

report={'scope':'Native authored geometry: field support, solids, irrigation clearance, planted roots and outside canal containment',
        'supportSamples':len(support),'unsupported':[q for q in support if not q['supported']],
        'closedSolidCount':len(closed),'openSolids':[q for q in closed if not q['closed']],
        'channels':channels,'channelSampleCount':sum(q['sampleCount'] for q in channels),
        'paddyWaterHeights':paddies,'plantedClumps':len(roots),
        'unrootedClumps':[q for q in roots if not q['rooted']],
        'outsideBankSamples':len(containment),'unretainedOutsideBank':[q for q in containment if not q['retained']],
        'limitations':'Decorative static geometry checks, not fluid simulation, browser/device checks, or full gameplay validation.'}
output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps(report,indent=2)+'\n')
assert not report['unsupported'], 'Unsupported agricultural geometry; see report'
assert not report['openSolids'], 'Agricultural volumes have open mesh edges; see report'
assert len(channels)==9 and not any(q['blockedSamples'] for q in channels), 'Blocked/missing channel; see report'
assert len(paddies)==3 and all(z==[1.81] for z in paddies.values()), 'Paddy water-height contract changed'
assert len(roots)==70 and not report['unrootedClumps'], 'Planted rice must remain rooted in the sediment'
assert not report['unretainedOutsideBank'], 'Outside canal bank has an opening; see report'
print('GUAIRA_RICE_AUDIT '+json.dumps({k:v for k,v in report.items() if k not in {'channels','scope','limitations'}}))
