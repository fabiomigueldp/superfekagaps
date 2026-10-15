"""Read-only production-camera detail renders, from either saved revision."""
import bpy,json,hashlib,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'output/guaira/path-finish-2026-10-15'
s=bpy.context.scene;before='--before' in sys.argv;s.render.resolution_x=3840;s.render.resolution_y=2400;s.render.resolution_percentage=100
s.render.threads_mode='FIXED';s.render.threads=4;s.cycles.samples=32
if s.compositing_node_group:
    for n in list(s.compositing_node_group.nodes):
        if n.bl_idname=='CompositorNodeOutputFile':s.compositing_node_group.nodes.remove(n)
s.render.use_border=True;s.render.use_crop_to_border=True;images=[]
for name,(x0,y0,x1,y1) in {'bridge':(.572,.635,.695,.785),'curbs':(.442,.535,.610,.715)}.items():
    s.render.border_min_x=x0;s.render.border_max_x=x1;s.render.border_min_y=1-y1;s.render.border_max_y=1-y0
    file=('before-' if before else 'detail-')+name+'.png';images.append(file)
    s.render.filepath=str(OUT/file);bpy.ops.render.render(write_still=True)
    print('PATH_DETAIL_RENDERED',name,flush=True)
(OUT/('before-detail-provenance.json' if before else 'detail-provenance.json')).write_text(json.dumps({
    'sourceSHA256':hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),
    'camera':'unchanged production orthographic camera','resolutionBeforeCrop':[3840,2400],'samples':32,'images':images},indent=2)+'\n')
