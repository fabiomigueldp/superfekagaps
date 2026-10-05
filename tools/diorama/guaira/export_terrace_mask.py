"""Export only the visible civic facing for bounded image packaging.

Run on each chapter/campaign .blend from the corresponding current builder:
blender -b SCENE.blend -t 4 -P tools/diorama/guaira/export_terrace_mask.py -- OUTPUT.png
Uses existing geometry as opaque occlusion. Never saves the material override.
"""
import bpy
import sys
from pathlib import Path

out = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
out.parent.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
visible = [o for o in scene.objects if o.name.startswith('Civic fitted retaining stone')]
assert visible, 'Build the current Guaíra source before exporting its facing mask'
materials = []
for name, color in [('Terrace mask occlusion', (0, 0, 0, 1)), ('Terrace mask visible', (1, 1, 1, 1))]:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    emission = nodes.new('ShaderNodeEmission')
    emission.inputs['Color'].default_value = color
    material.node_tree.links.new(emission.outputs[0], output.inputs['Surface'])
    materials.append(material)
for ob in scene.objects:
    if ob.type in {'MESH', 'CURVE', 'FONT', 'SURFACE'}:
        ob.data = ob.data.copy()
        ob.data.materials.clear()
        ob.data.materials.append(materials[int(ob in visible)])
scene.world.node_tree.nodes['Background'].inputs[1].default_value = 0
scene.cycles.samples = 8
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(out)
bpy.ops.render.render(write_still=True)
