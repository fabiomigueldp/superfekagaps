"""Package the map-sign renders without touching game files or making previews.

python package_map_signs.py --repo-root REPO --render-dir RENDERS --output-dir ASSETS
Optional --verify-against FROZEN compares atlas and manifest byte-for-byte.
Repository/output defaults may use FEKA_SIGN_REPO_ROOT/FEKA_SIGN_OUTPUT_DIR;
the PNG input directory may use FEKA_SIGN_RENDER_DIR.
Requires Pillow and NumPy. The Blender renderer writes signs.meta.json and PNGs.
"""
from pathlib import Path
import argparse, hashlib, json, os, re, unicodedata
from PIL import Image
import numpy as np

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repo-root',default=os.environ.get('FEKA_SIGN_REPO_ROOT'))
parser.add_argument('--render-dir',default=os.environ.get('FEKA_SIGN_RENDER_DIR'))
parser.add_argument('--output-dir',default=os.environ.get('FEKA_SIGN_OUTPUT_DIR'))
parser.add_argument('--verify-against')
parser.add_argument('--factory-only',action='store_true',help='Package only the wider Factory arrow as a separate optional atlas; preserve the released seven-frame atlas')
args=parser.parse_args()
if not args.repo_root or not args.render_dir or not args.output_dir:
    parser.error('--repo-root, --render-dir and --output-dir (or FEKA_SIGN_* equivalents) are required')
repo=Path(args.repo_root).expanduser().resolve()
renders=Path(args.render_dir).expanduser().resolve()
output=Path(args.output_dir).expanduser().resolve()
frozen=Path(args.verify_against).expanduser().resolve() if args.verify_against else None
if frozen and frozen==output:parser.error('Verification output must be separate from the frozen assets')
output.mkdir(parents=True,exist_ok=True)
metas=json.loads((renders/'signs.meta.json').read_text())
expected=['factory-right'] if args.factory_only else ['stage','selected','complete','locked','selected-complete','dock-right','dock-left']
metas=[m for m in metas if m['kind'] in expected]
if {m['kind'] for m in metas}!=set(expected):
    raise ValueError(f'Render every required sign state before packaging: {expected}')

palette=dict(re.findall(r"([A-Za-z][A-Za-z0-9]*)\s*:\s*'(#[0-9a-fA-F]{6})'",(repo/'src/graphics/palette.ts').read_text()))
glyphs={}
for match in re.finditer(r"(?:'([^']+)'|\b([A-Z]))\s*:\s*'([01/]+)'",(repo/'src/graphics/BitmapFont.ts').read_text()):
    glyphs[match.group(1) or match.group(2)]=match.group(3).split('/')
def bitmap_width(text):
    return (sum(len(glyphs[unicodedata.normalize('NFD',c)[0]][0])+1 for c in text)-1)*2

exports=[]
for m in metas:
    im=Image.open(renders/m['image']).convert('RGBA')
    if im.size!=(m['cssWidth']*4,m['cssHeight']*4):
        raise ValueError(f"Unexpected render dimensions for {m['kind']}")
    if m['palette']['letters']!=palette['ink'] or m['palette']['closedLetters']!=palette['ink']:
        raise ValueError('Every sign state must retain the original dark bitmap text color')
    labels=['FÁBRICA'] if m['kind']=='factory-right' else ['COSTA','PORTO'] if m['kind'].startswith('dock') else [f'{world}-{stage}' for world in range(1,7) for stage in range(1,6)]
    letter_height=18 if m['kind']=='factory-right' else 14
    text_y=round(m['letterCenter']['y']-7)
    text_top=text_y-4 if m['kind']=='factory-right' else text_y
    if any(bitmap_width(label)>m['usableFace']['width'] for label in labels) or letter_height>m['usableFace']['height'] or text_top<m['usableFace']['y'] or text_y+14>m['usableFace']['y']+m['usableFace']['height']:
        raise ValueError(f"Original bitmap lettering no longer fits {m['kind']}")
    array=np.array(im);h,w=array.shape[:2];yy,xx=np.mgrid[:h,:w]
    edge=np.minimum.reduce([xx/30,(w-1-xx)/30,yy/30,(h-1-yy)/30,np.ones_like(xx)]).clip(0,1)
    soft=array[:,:,3]<170
    array[:,:,3]=np.where(soft,array[:,:,3]*edge,array[:,:,3]).astype(np.uint8)
    im=Image.fromarray(array)
    packed=im.resize((m['cssWidth']*2,m['cssHeight']*2),Image.Resampling.LANCZOS)
    array=np.array(packed)
    array[:2,:,3]=0;array[-2:,:,3]=0;array[:,:2,3]=0;array[:,-2:,3]=0
    packed=Image.fromarray(array)
    path=output/f"{m['kind']}-dpr2.webp"
    packed.save(path,'WEBP',quality=90,method=4,alpha_quality=100)
    exports.append({**m,'image':path.name,'dpr':2,'decorativeTranslateY':round(m['cssHeight']-m['foot']['y'],3),'bytes':path.stat().st_size})
(output/'signs-dpr2.meta.json').write_text(json.dumps(exports,indent=2))
by_kind={m['kind']:m for m in exports}
atlas_size=(256,112) if args.factory_only else (560,232)
atlas_name='signs-factory' if args.factory_only else 'signs-atlas'
atlas=Image.new('RGBA',atlas_size);frames=[]
for i,kind in enumerate(expected):
    m=by_kind[kind];x,y=(0,0) if args.factory_only else (i*112,0) if i<5 else ((i-5)*208,120)
    im=Image.open(output/m['image']).convert('RGBA');atlas.alpha_composite(im,(x,y))
    frames.append({**m,'sourceRect':{'x':x,'y':y,'width':im.width,'height':im.height},'displaySize':{'width':m['cssWidth'],'height':m['cssHeight']}})
atlas_path=output/f'{atlas_name}.webp'
atlas.save(atlas_path,'WEBP',quality=90,method=6,alpha_quality=100)
manifest={'version':1,'coordinateSystem':'sourceRect is physical atlas pixels; displaySize, foot, letterCenter, usableFace and decorativeTranslateY are CSS pixels. Glyph cells are integer2CSSpx.','atlas':{'image':atlas_path.name,'width':atlas_size[0],'height':atlas_size[1],'bytes':atlas_path.stat().st_size},'frames':frames}
(output/f'{atlas_name}.meta.json').write_text(json.dumps(manifest,indent=2))

decoded=Image.open(atlas_path).convert('RGBA');checks=[]
for frame in frames:
    r=frame['sourceRect'];crop=decoded.crop((r['x'],r['y'],r['x']+r['width'],r['y']+r['height']))
    alpha=np.asarray(crop)[:,:,3]
    edges={key:int(value.max()) for key,value in {'top':alpha[:2,:],'right':alpha[:,-2:],'bottom':alpha[-2:,:],'left':alpha[:,:2]}.items()}
    if max(edges.values())!=0:raise ValueError(f"Nontransparent frame edge: {frame['kind']}")
    if abs(frame['foot']['y']+frame['decorativeTranslateY']-frame['cssHeight'])>=.001:
        raise ValueError(f"Physical foot alignment drift: {frame['kind']}")
    checks.append({'kind':frame['kind'],'edgeAlphaMax':edges,'foot':frame['foot'],'usableFace':frame['usableFace']})
hashes={name:hashlib.sha256((output/name).read_bytes()).hexdigest() for name in [f'{atlas_name}.webp',f'{atlas_name}.meta.json']}
verification=None
if frozen:
    verification={name:(output/name).read_bytes()==(frozen/name).read_bytes() for name in hashes}
    if not all(verification.values()):raise ValueError(f'Frozen atlas/manifest comparison failed: {verification}')
validation={'allEdgesTransparent':True,'atlasBytes':atlas_path.stat().st_size,'atlasSize':list(decoded.size),'frameCount':len(frames),'hashes':hashes,'frozenByteComparison':verification,'assets':checks}
(output/('factory-sign-validation.json' if args.factory_only else 'signs-validation.json')).write_text(json.dumps(validation,indent=2)+'\n')
print(json.dumps({key:validation[key] for key in ['allEdgesTransparent','atlasBytes','frameCount','hashes','frozenByteComparison']},indent=2))
