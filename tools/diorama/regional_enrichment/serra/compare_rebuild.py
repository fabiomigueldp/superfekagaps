import bpy,json,sys,hashlib
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:];other=Path(args[0]).resolve();out=Path(args[1]).resolve()
def snapshot():
 bpy.context.view_layer.update();r={}
 for o in bpy.context.scene.objects:
  d={'type':o.type,'matrix':[list(row) for row in o.matrix_world],'group':o.get('enrichment_group'),'modifiers':[(m.type,m.width if m.type=='BEVEL' else None,m.segments if m.type=='BEVEL' else None) for m in o.modifiers]}
  if o.type=='MESH':d.update(vertices=[list(v.co) for v in o.data.vertices],faces=[list(f.vertices) for f in o.data.polygons],faceMaterials=[f.material_index for f in o.data.polygons],materials=[m.name for m in o.data.materials])
  elif o.type=='CURVE':d.update(bevel=o.data.bevel_depth,splines=[[[*p.co] for p in sp.points] for sp in o.data.splines],materials=[m.name for m in o.data.materials])
  r[o.name]=hashlib.sha256(json.dumps(d,sort_keys=True).encode()).hexdigest()
 return r,json.loads(bpy.context.scene['serra_metadata'])
first,meta=snapshot();bpy.ops.wm.open_mainfile(filepath=str(other));second,meta2=snapshot();diff=[k for k in first.keys()|second.keys() if first.get(k)!=second.get(k)];report={'passed':not diff and meta==meta2,'objectCount':len(first),'geometryTransformsAndMaterialBindingsReproduced':not diff,'metadataExact':meta==meta2,'differentObjects':diff};out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True);assert report['passed']
