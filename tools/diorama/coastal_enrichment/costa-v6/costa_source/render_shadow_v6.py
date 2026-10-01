import os
"""Matching RGBA shadow asset, with the baseline Blender-only finishing policy."""
import bpy
from pathlib import Path
P=Path(os.environ["FEKA_OUTPUT_DIR"])
s=bpy.context.scene
for o in s.objects:
 if o.type in {'MESH','CURVE'}:
  o.visible_camera=False
  if o.get('decorative_floor'):o.visible_shadow=False
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.04));catcher=bpy.context.object;catcher.name='v6 separate contact shadow catcher';catcher.is_shadow_catcher=True
m=bpy.data.materials.new('v6 ocean shadow receiver');m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*tuple(((c+.055)/1.055)**2.4 for c in (.30,.60,.65)),1);catcher.data.materials.append(m)
s.cycles.samples=16;s.cycles.use_denoising=False;s.render.resolution_percentage=100;s.render.filepath=str(P/'costa-v6-shadow-raw.png');bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.ops.object.camera_add();s.camera=bpy.context.object;s.cycles.samples=1;s.use_nodes=True;tree=s.node_tree;tree.nodes.clear()
source=tree.nodes.new('CompositorNodeImage');source.image=bpy.data.images.load(str(P/'costa-v6-shadow-raw.png'),check_existing=False)
blur=tree.nodes.new('CompositorNodeBlur');blur.filter_type='GAUSS';blur.size_x=9;blur.size_y=9;tree.links.new(source.outputs['Alpha'],blur.inputs['Image'])
subtract=tree.nodes.new('CompositorNodeMath');subtract.operation='SUBTRACT';subtract.inputs[1].default_value=.035;subtract.use_clamp=True;tree.links.new(blur.outputs['Image'],subtract.inputs[0])
strength=tree.nodes.new('CompositorNodeMath');strength.operation='MULTIPLY';strength.inputs[1].default_value=.62;strength.use_clamp=True;tree.links.new(subtract.outputs[0],strength.inputs[0])
alpha=tree.nodes.new('CompositorNodeSetAlpha');alpha.mode='REPLACE_ALPHA';alpha.inputs['Image'].default_value=(0,0,0,1);tree.links.new(strength.outputs[0],alpha.inputs['Alpha']);composite=tree.nodes.new('CompositorNodeComposite');tree.links.new(alpha.outputs['Image'],composite.inputs['Image'])
s.render.filepath=str(P/'costa-v6-shadow.png');bpy.ops.render.render(write_still=True)
