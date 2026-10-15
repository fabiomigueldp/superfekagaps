"""Export matching beauty, depth and navigation from an authored island scene."""
import bpy
import json
import math
from array import array
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view


def export_island(scene, metadata, routes, revision, source, review, draft=False, render=True):
    bpy.context.view_layer.update()
    deps= bpy.context.evaluated_depsgraph_get();camera=scene.camera
    inverse=camera.matrix_world.inverted();toward=camera.matrix_world.to_quaternion()@Vector((0,0,1))
    def project(p):
        q=world_to_camera_view(scene,camera,Vector(p));return {'x':round(q.x,7),'y':round(1-q.y,7)}
    def distance(p):return round(-(inverse@Vector(p)).z,6)
    def visible(p):
        origin=p+toward*160
        for _ in range(16):
            remaining=(origin-p).dot(toward)-.12
            if remaining<=0:return True
            hit,loc,normal,face,obj,matrix=scene.ray_cast(deps,origin,-toward,distance=remaining)
            if not hit:return True
            if not obj.hide_render:return False
            origin=loc-toward*.002
        return True
    for record in metadata['routes']:
        line=routes[record['id']]
        record['points']=[project(p) for p in line];record['depths']=[distance(p) for p in line]
        record['visible']=[visible(p) for p in line]
        record['duration']=round(max(.6,sum((b-a).length for a,b in zip(line,line[1:]))/8),3)
        for sid,p in [(record['from'],line[0]),(record['to'],line[-1])]:
            metadata['nodeDepths'][sid]=distance(p)
            (metadata['nodes'] if sid in metadata['nodes'] else metadata['junctions'])[sid]=project(p)
    metadata['revision']=revision;metadata['objects']=len(scene.objects)
    metadata['source']=f'docs/world/delicia/imperio-delicia-v{revision}.blend'
    metadata['navigation']='14 landings; 16 authored routes; joined masonry paving, closed stairs and linear camera depth'
    scene['model_revision']=revision;scene['navigation_revision']=revision-4
    scene.render.resolution_x=1440 if draft else 2560;scene.render.resolution_y=900 if draft else 1600
    scene.render.resolution_percentage=100;scene.cycles.samples=16 if draft else 48
    scene.cycles.device='CPU';scene.render.threads_mode='FIXED';scene.render.threads=4
    scene.view_layers[0].use_pass_z=True
    group=bpy.data.node_groups.new(f'Island v{revision} beauty and camera depth','CompositorNodeTree');scene.compositing_node_group=group
    group.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
    image=group.nodes.new('CompositorNodeRLayers');image.scene=scene
    out=group.nodes.new('NodeGroupOutput');group.links.new(image.outputs['Image'],out.inputs['Image'])
    depth=group.nodes.new('CompositorNodeOutputFile');depth.directory=str(review)
    depth.file_name=f'depth-v{revision}'+('-draft' if draft else '')
    depth.format.media_type='IMAGE';depth.format.file_format='OPEN_EXR';depth.format.color_depth='32';depth.format.color_mode='RGB'
    depth.save_as_render=False;depth.file_output_items.new('RGBA','Depth');group.links.new(image.outputs['Depth'],depth.inputs[0])
    destination=review if draft else source
    scene.render.filepath=str(destination/(f'island-v{revision}-draft.png' if draft else f'island-render-v{revision}.png'))
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    bpy.ops.wm.save_as_mainfile(filepath=str(destination/f'imperio-delicia-v{revision}.blend'))
    (destination/f'island-map-v{revision}.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'DELICIA V{revision}: geometry and projected navigation saved',flush=True)
    if not render:return
    bpy.ops.render.render(write_still=True)
    pattern=f'depth-v{revision}'+('-draft' if draft else '')+'Depth*.exr'
    exr=max(review.glob(pattern),key=lambda p:p.stat().st_mtime)
    image=bpy.data.images.load(str(exr),check_existing=False)
    pixels=array('f',[0])*len(image.pixels);image.pixels.foreach_get(pixels)
    width,height=image.size;packed=array('H')
    for y in reversed(range(height)):
        for x in range(width):
            z=pixels[(y*width+x)*4]
            packed.append(min(65535,max(0,round(z*256))) if math.isfinite(z) else 65535)
    (review/('depth-draft.u16' if draft else 'depth.u16')).write_bytes(packed.tobytes())
    print('DEPTH_PACKED',width,height,flush=True)
