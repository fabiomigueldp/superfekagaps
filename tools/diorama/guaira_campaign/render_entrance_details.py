"""Read-only crop renders of the saved entrance scene; no source mutation."""
import bpy,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'output/guaira/entrance-finish-2026-10-15'
s=bpy.context.scene;s.render.resolution_x=3840;s.render.resolution_y=2400;s.render.resolution_percentage=100
s.render.threads_mode='FIXED';s.render.threads=4;s.cycles.samples=32
if s.compositing_node_group:
    for n in list(s.compositing_node_group.nodes):
        if n.bl_idname=='CompositorNodeOutputFile':s.compositing_node_group.nodes.remove(n)
s.render.use_border=True;s.render.use_crop_to_border=True
for name,(x0,y0,x1,y1) in {'workshop':(.395,.465,.55,.595),'corral':(.505,.53,.645,.665),'hoist':(.667,.505,.737,.645)}.items():
    s.render.border_min_x=x0;s.render.border_max_x=x1;s.render.border_min_y=1-y1;s.render.border_max_y=1-y0
    s.render.filepath=str(OUT/('detail-'+name+'.png'));bpy.ops.render.render(write_still=True)
    print('ENTRANCE_DETAIL_RENDERED',name,flush=True)
(OUT/'detail-provenance.json').write_text(json.dumps({'sourceSHA256':hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),
    'camera':'unchanged production orthographic camera','resolutionBeforeCrop':[3840,2400],'samples':32,
    'images':['detail-workshop.png','detail-corral.png','detail-hoist.png']},indent=2)+'\n')
