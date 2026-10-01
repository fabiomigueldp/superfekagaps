"""Optional verification: compare rebuilt art geometry/shaders to a local reference.
blender -b -P compare_scene_signatures.py -- --reference old.blend --rebuilt new.blend --report compare.json
No rendering or source-scene mutation occurs.
"""
import argparse,hashlib,json,sys
from pathlib import Path
import bpy

def value(x):
 if isinstance(x,(str,bool,int)) or x is None:return x
 if isinstance(x,float):return round(x,7)
 try:return [value(v) for v in x]
 except TypeError:return str(type(x).__name__)
def digest(data):return hashlib.sha256(json.dumps(data,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def material(m):
 if m is None:return None
 result={'diffuse':value(m.diffuse_color),'nodes':{},'links':[]}
 if m.use_nodes:
  for n in m.node_tree.nodes:
   item={'type':n.bl_idname,'inputs':{i.identifier:value(i.default_value) for i in n.inputs if hasattr(i,'default_value')}}
   for prop in ['operation','blend_type','interpolation_type','clamp','use_clamp','layer_name','data_type','noise_dimensions']:
    if hasattr(n,prop):item[prop]=value(getattr(n,prop))
   if hasattr(n,'color_ramp'):item['color_ramp']={'interpolation':n.color_ramp.interpolation,'elements':[(value(e.position),value(e.color)) for e in n.color_ramp.elements]}
   result['nodes'][n.name]=item
  result['links']=sorted((l.from_node.name,l.from_socket.identifier,l.to_node.name,l.to_socket.identifier)for l in m.node_tree.links)
 return digest(result)
def snapshot(file):
 bpy.ops.wm.open_mainfile(filepath=str(file));s=bpy.context.scene;objects={};materials={m.name:material(m)for m in bpy.data.materials if m.users}
 for o in s.objects:
  item={'type':o.type,'matrix':value(o.matrix_world),'visibility':{k:value(getattr(o,k))for k in ['hide_render','visible_camera','visible_shadow']if hasattr(o,k)},'materials':[materials[m.name] if m else None for m in o.data.materials] if hasattr(o.data,'materials') else [],'properties':{k:value(o[k])for k in ['enrichment_group','decorative_floor']if k in o},'modifiers':[]}
  if o.type=='MESH':item['mesh']={'vertices':[value(v.co)for v in o.data.vertices],'faces':[(value(p.vertices),p.material_index,p.use_smooth)for p in o.data.polygons],'color_attributes':{a.name:{'domain':a.domain,'type':a.data_type,'values':[value(c.color)for c in a.data]}for a in o.data.color_attributes}}
  if o.type=='CURVE':item['curve']={'bevel_depth':value(o.data.bevel_depth),'bevel_resolution':o.data.bevel_resolution,'dimensions':o.data.dimensions,'splines':[(sp.type,[value(p.co)for p in sp.points])for sp in o.data.splines]}
  if o.type=='LIGHT':item['light']={k:value(getattr(o.data,k))for k in ['type','energy','color','size']if hasattr(o.data,k)}
  if o.type=='CAMERA':item['camera']={'type':o.data.type,'ortho_scale':value(o.data.ortho_scale)}
  for m in o.modifiers:
   item['modifiers'].append({k:value(getattr(m,k)) for k in ['name','type','width','segments','thickness','use_even_offset','show_render','keep_sharp','weight','thresh','limit_method']if hasattr(m,k)})
  objects[o.name]=digest(item)
 return {'objects':objects,'materials':materials,'camera':s.camera.name,'render':{'settings':{k:value(getattr(s.render,k))for k in ['engine','resolution_x','resolution_y','resolution_percentage','film_transparent']},'cycles':{k:value(getattr(s.cycles,k))for k in ['samples','use_denoising','max_bounces','diffuse_bounces','glossy_bounces','seed']}},'world': {'color':value(s.world.node_tree.nodes['Background'].inputs[0].default_value),'strength':value(s.world.node_tree.nodes['Background'].inputs[1].default_value)},'view':{k:value(getattr(s.view_settings,k))for k in ['view_transform','look','exposure','gamma']}}
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--reference',type=Path,required=True);parser.add_argument('--rebuilt',type=Path,required=True);parser.add_argument('--report',type=Path,required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);a=snapshot(args.reference);b=snapshot(args.rebuilt)
report={'referenceObjectCount':len(a['objects']),'rebuiltObjectCount':len(b['objects']),'missingObjects':sorted(set(a['objects'])-set(b['objects'])),'addedObjects':sorted(set(b['objects'])-set(a['objects'])),'changedObjects':[n for n in a['objects'] if n in b['objects'] and a['objects'][n]!=b['objects'][n]],'cameraWorldViewEqual':all(a[k]==b[k] for k in ['camera','world','view','render']),'referenceGeometryMaterialDigest':digest(a['objects']),'rebuiltGeometryMaterialDigest':digest(b['objects'])}
report['matched']=not any(report[k] for k in ['missingObjects','addedObjects','changedObjects']) and report['cameraWorldViewEqual'];args.report.write_text(json.dumps(report,indent=2));print(json.dumps(report));assert report['matched'], 'Scene differs from reference; see report'
