"""Final rendering from disposable Blender cache, with canonical metadata embedded at build.
blender -b /tmp/fabrica-map-prototype.blend -t 12 -P tools/diorama/render_fabrica_cached.py
Use render_fabrica_map.py -- --final for a complete canonical rebuild instead.
"""
import bpy,json,os,runpy
from array import array
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'));OUT=os.path.join(ROOT,'public/assets/world/map');DOC=os.path.join(ROOT,'docs/world/diorama')
scene=bpy.context.scene;scene.render.resolution_percentage=100;scene.cycles.samples=160;scene.cycles.use_denoising=False;scene.render.use_border=False;scene.render.use_crop_to_border=False
assert all(mod.type!='BOOLEAN' for ob in scene.objects for mod in ob.modifiers)
assert 'fabrica_metadata' in scene,'Cache predates embedded canonical metadata; rebuild source'
meta=json.loads(scene['fabrica_metadata'])
audit=runpy.run_path(os.path.join(ROOT,'tools/diorama/check_fabrica_clearance.py'),init_globals={'FABRICA_META':meta},run_name='__main__');meta=audit['meta']
scene.render.filepath=os.path.join(OUT,'fabrica-diorama.png');bpy.ops.render.render(write_still=True)
im=bpy.data.images.load(scene.render.filepath,check_existing=False);w,h=im.size;px=array('f',[0])*(w*h*4);im.pixels.foreach_get(px);xs=[];ys=[]
for i in range(w*h):
 if px[i*4+3]>0:xs.append(i%w);ys.append(i//w)
meta['artBounds']={'top':round(1-(max(ys)+1)/h,6),'bottom':round(1-min(ys)/h,6),'left':round(min(xs)/w,6),'right':round((max(xs)+1)/w,6)};meta['status']='authored-candidate-for-runtime-review'
json.dump(meta,open(os.path.join(OUT,'fabrica-diorama.meta.json'),'w'),indent=2)
print('FABRICA_FINAL_BOUNDS='+json.dumps(meta['artBounds']))
