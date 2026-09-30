"""Classify only the existing embarkation docks for the sea silhouette audit.

Run on a cached journey-dock.blend with -- costa or -- porto. Other original
objects are camera holdouts; the new overlay is absent. This prevents the sea
audit from treating intended mooring overlap as a shoreline collision while
still checking every rock/island pixel, even at the endpoints.
"""
import bpy,sys
island='porto' if 'porto' in sys.argv else 'costa'
scene=bpy.context.scene
for ob in scene.objects:
    if ob.type not in {'MESH','CURVE'}:continue
    ob.hide_render=ob.name.startswith('journey_')
    matches=ob.name.startswith(('dock ','pile cut end','barrel iron band')) if island=='costa' else ('arrival pier' in ob.name or ob.name.startswith('edge mooring bollard'))
    ob.is_holdout=not matches
scene.render.resolution_x=1920;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.cycles.samples=4;scene.cycles.use_denoising=False;scene.render.film_transparent=True
scene.render.filepath=f'/tmp/feka-journey/{island}/original-dock-mask.png'
bpy.ops.render.render(write_still=True)
