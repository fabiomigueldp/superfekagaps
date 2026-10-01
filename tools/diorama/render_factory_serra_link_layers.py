from pathlib import Path
import bpy,json,sys,os
from mathutils import Vector
O=Path(os.environ.get('FEKA_FACTORY_SERRA_OUT','/tmp/feka-factory-serra-link'));(O/'final').mkdir(parents=True,exist_ok=True);state='closed' if '--closed' in sys.argv else 'open';FINAL='--final' in sys.argv
bpy.ops.wm.open_mainfile(filepath=str(O/f'factory-serra-{state}.blend'));s=bpy.context.scene;c=s.camera
for ob in s.objects:
 if ob.type in {'MESH','CURVE','FONT'} and not ob.get('new_link'):ob.is_holdout=True
left,top,width,height=2.40,-.12,1.00,.90
basis=c.rotation_euler.to_matrix();c.location+=basis@Vector((((left-1.98)+width/2-.5)*20.6,-((top-.03)+height/2-.5)*12.875,0));c.data.ortho_scale=20.6*width
s.render.resolution_x=1920 if FINAL else 1600;s.render.resolution_y=1080 if FINAL else 900;s.render.resolution_percentage=100;s.render.film_transparent=True;s.cycles.samples=96 if FINAL else 16;s.cycles.use_denoising=False;s.render.filepath=str((O/'final' if FINAL else O)/f'factory-serra-{state}-layer-full.png');bpy.ops.render.render(write_still=True)
((O/'final' if FINAL else O)/'overlay-frame.json').write_text(json.dumps({'left':left,'top':top,'widthInMap':width,'heightInMap':height,'size':[s.render.resolution_x,s.render.resolution_y],'samples':s.cycles.samples},indent=2))
