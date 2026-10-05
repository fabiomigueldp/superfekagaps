"""Render matched support-review views from a saved Guaíra scene.

blender -b SCENE.blend -t 4 -P tools/diorama/guaira/render_support_views.py -- OUTPUT
These are Blender geometry reviews, not browser/device screenshots. No scene or
runtime asset is overwritten. The same cameras must be used before and after.
"""
import argparse
from pathlib import Path
import sys

import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('output', type=Path)
parser.add_argument('--samples', type=int, default=24)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
args.output.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
camera = scene.camera
scene.render.engine = 'CYCLES'
scene.cycles.samples = args.samples
scene.cycles.use_denoising = False
scene.render.resolution_x = 1440
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'

for name, position, target, scale in [
    ('front-right-support', (13, -20, 10), (1, -.2, 1.8), 19.5),
    ('rear-left-support', (-14, 19, 10), (-.6, 1, 2), 20),
]:
    camera.location = position
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.ortho_scale = scale
    scene.render.filepath = str(args.output / f'{name}.png')
    bpy.ops.render.render(write_still=True)
