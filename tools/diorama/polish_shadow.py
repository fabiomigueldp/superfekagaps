"""Blender compositor finishing for the independent Cycles contact-shadow layer.
Smooth stochastic catcher alpha, remove its near-zero noise floor, and soften strength.
All processing stays in the authored Blender pipeline; no raster painting is involved.
"""
import bpy, os, shutil
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
OUT=os.path.join(ROOT,'public/assets/world/map/costa-shadow.png')
RAW='/tmp/costa-shadow-raw.png';shutil.copy2(OUT,RAW)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;bpy.ops.object.camera_add();scene.camera=bpy.context.object
scene.render.engine='CYCLES';scene.cycles.samples=1;scene.cycles.use_denoising=False;scene.render.film_transparent=True
scene.render.resolution_x=1920;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.use_nodes=True;tree=scene.node_tree;tree.nodes.clear()
source=tree.nodes.new('CompositorNodeImage');source.image=bpy.data.images.load(RAW,check_existing=False)
blur=tree.nodes.new('CompositorNodeBlur');blur.filter_type='GAUSS';blur.size_x=9;blur.size_y=9
tree.links.new(source.outputs['Alpha'],blur.inputs['Image'])
subtract=tree.nodes.new('CompositorNodeMath');subtract.operation='SUBTRACT';subtract.inputs[1].default_value=.035;subtract.use_clamp=True;tree.links.new(blur.outputs['Image'],subtract.inputs[0])
strength=tree.nodes.new('CompositorNodeMath');strength.operation='MULTIPLY';strength.inputs[1].default_value=.62;strength.use_clamp=True;tree.links.new(subtract.outputs[0],strength.inputs[0])
alpha=tree.nodes.new('CompositorNodeSetAlpha');alpha.mode='REPLACE_ALPHA';alpha.inputs['Image'].default_value=(0,0,0,1);tree.links.new(strength.outputs[0],alpha.inputs['Alpha'])
composite=tree.nodes.new('CompositorNodeComposite');tree.links.new(alpha.outputs['Image'],composite.inputs['Image'])
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='8';scene.render.filepath=OUT
bpy.ops.render.render(write_still=True)
