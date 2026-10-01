import bpy,sys,json,hashlib,runpy
from pathlib import Path
p=Path(__file__).resolve().parent;out=Path(bpy.data.filepath).parent;s=bpy.context.scene
metadata=json.loads(s['serra_metadata']);published=json.load(open(p/'source/base-serra.meta.json'));fields=['camera','nodes','routes','secretTransport','secretRoute','routeDurationsSeconds','size']
checks={k:metadata[k]==published[k] for k in fields};assert all(checks.values()),checks
# Rebuild the pinned original from source, checking all base geometry signatures and camera/light properties.
def signature(o):
 d={'name':o.name,'type':o.type,'matrix':[list(row) for row in o.matrix_world],'modifiers':[(m.type,m.width if m.type=='BEVEL' else None,m.segments if m.type=='BEVEL' else None) for m in o.modifiers]}
 if o.type=='MESH':d.update(vertices=[list(v.co) for v in o.data.vertices],faces=[list(f.vertices) for f in o.data.polygons])
 elif o.type=='CURVE':d.update(bevel=o.data.bevel_depth,splines=[[[*p.co] for p in sp.points] for sp in o.data.splines])
 return hashlib.sha256(json.dumps(d,sort_keys=True).encode()).hexdigest()
bpy.context.view_layer.update();got={o.name:signature(o) for o in s.objects if not o.get('enrichment_group')};extras=sum(bool(o.get('enrichment_group')) for o in s.objects);current_meta=json.loads(s['serra_metadata']);lights={o.name:[list(o.location),o.data.energy,list(o.data.color),o.data.size] for o in s.objects if o.type=='LIGHT'}
ns=runpy.run_path(str(p/'source/serra_baseline.py'),init_globals={'FEKA_SERRA_OUT':str(out),'FEKA_SERRA_BUILD_ONLY':True});bpy.context.view_layer.update();expected={o.name:signature(o) for o in bpy.context.scene.objects};source_lights={o.name:[list(o.location),o.data.energy,list(o.data.color),o.data.size] for o in bpy.context.scene.objects if o.type=='LIGHT'}
assert got==expected;assert lights==source_lights;assert current_meta==json.loads(json.dumps(ns['meta']))
report={'passed':True,'checkedOriginalObjects':len(got),'newObjects':extras,'geometryAndTransformsExact':True,'fullSourceMetadataExact':True,'cameraLightsExact':True,'publishedRuntimeFieldsExact':checks,'sourceSha256':hashlib.sha256((p/'source/serra_baseline.py').read_bytes()).hexdigest()};(out/'independent-invariants.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
