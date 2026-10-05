"""Package the freshly rendered visible-water mask without old-camera crops."""
from PIL import Image, ImageFilter
import json, os, hashlib, argparse
import numpy as np
from water_regions import split_visible_mask, pack_regions

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--input', required=True)
parser.add_argument('--asset-output', required=True)
parser.add_argument('--data-output', required=True)
parser.add_argument('--source-commit', default=None, help='Optional actual authored geometry commit, never an inherited fixed hash')
args=parser.parse_args()
ASSETS=os.path.abspath(args.input)
DEST=os.path.abspath(args.asset_output)
os.makedirs(DEST, exist_ok=True)
os.makedirs(os.path.dirname(os.path.abspath(args.data_output)), exist_ok=True)
source=json.load(open(ASSETS+'/water-surfaces-source.json'))
mask=Image.open(ASSETS+'/water-mask-source.png').convert('L')
assert list(mask.size) == source['sourceSize'] == [1920,1200]
# Recover emission coverage and inset one source pixel to protect occluder edges.
mask=mask.point(lambda x: 0 if x<8 else round((x/255)**2.2*255)).filter(ImageFilter.MinFilter(3))
regions, atlas_size=pack_regions(split_visible_mask(mask))
scratch_size=[max(r['bounds'][2] for r in regions), max(r['bounds'][3] for r in regions)]
decoded_bytes=(atlas_size[0]*atlas_size[1]+scratch_size[0]*scratch_size[1])*4
assert decoded_bytes < 1024*1024, f'Water decoration exceeds one MiB: {decoded_bytes}; review crop partition before raising budget'
atlas=Image.new('LA',tuple(atlas_size),(255,0))
covered=Image.new('L',mask.size,0)
for r in regions:
 x,y,w,h=r['bounds'];patch=mask.crop((x,y,x+w,y+h))
 part=Image.new('LA',(w,h),(255,0));part.putalpha(patch)
 atlas.paste(part,tuple(r['atlas']));covered.paste(patch,(x,y))
assert mask.tobytes()==covered.tobytes(), 'Region layout missed mask pixels'
atlas.save(DEST+'/guaira-water-mask.png',optimize=True)
channels=[];paddies=[]
for s in source['surfaces']:
 v=s['vertices']
 if 'flowing' in s['name']:
  assert len(v)==4, f"Channel {s['name']} must export an ordered ribbon quad"
  channels.append({'a':[(v[0][i]+v[1][i])/2 for i in range(3)],'b':[(v[2][i]+v[3][i])/2 for i in range(3)],'edge':[(v[0][i]-v[1][i])*.34 for i in range(3)],'velocity':.55 if s['name'].startswith('Gravity') else .28})
 elif 'paddy' in s['name']:paddies.append([sum(q[i] for q in v)/len(v) for i in range(2)])
contract={'version':1,'sourceSize':[1920,1200], 'atlasSize':atlas_size,'regions':regions,'projection':source['projection'], 'channels':channels,'paddies':paddies,'maskInsetPixels':1}
if args.source_commit:contract['sourceCommit']=args.source_commit
with open(args.data_output,'w') as f:
 json.dump(contract,f,separators=(',',':'));f.write('\n')
report={'atlasBytes':os.path.getsize(DEST+'/guaira-water-mask.png'), 'contractBytes':os.path.getsize(args.data_output), 'atlasSize':atlas_size,'scratchSize':scratch_size, 'decodedAtlasBytes':atlas_size[0]*atlas_size[1]*4,'scratchCanvasBytes':scratch_size[0]*scratch_size[1]*4, 'croppedSourcePixels':sum(r['bounds'][2]*r['bounds'][3] for r in regions),'activeSourcePixels':int(np.count_nonzero(mask)), 'allVisiblePixelsPreserved':True,'maskSourceSHA256':hashlib.sha256(open(ASSETS+'/water-mask-source.png','rb').read()).hexdigest()}
json.dump(report,open(DEST+'/guaira-water-cost.json','w'),indent=2)
print(json.dumps(report,indent=2))
