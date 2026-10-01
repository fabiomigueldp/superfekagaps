import bpy,sys,argparse
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--samples',type=int,default=128);p.add_argument('--percentage',type=int,default=100);a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);s=bpy.context.scene
for o in s.objects:
 if o.name.startswith(('maintenance carrier A','maintenance carrier B')):o.hide_render=True
s.render.resolution_percentage=a.percentage;s.cycles.samples=a.samples;s.cycles.use_denoising=False;s.render.filepath=str(Path(a.output).resolve());bpy.ops.render.render(write_still=True)
