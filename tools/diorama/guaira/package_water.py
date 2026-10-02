from PIL import Image, ImageFilter
import json, os, hashlib, argparse

parser=argparse.ArgumentParser(description='Package Guaíra visible-water mask into a cropped atlas')
parser.add_argument('--input', required=True)
parser.add_argument('--asset-output', required=True)
parser.add_argument('--data-output', required=True)
args=parser.parse_args()
ASSETS=os.path.abspath(args.input)
DEST=os.path.abspath(args.asset_output)
os.makedirs(DEST, exist_ok=True)
os.makedirs(os.path.dirname(os.path.abspath(args.data_output)), exist_ok=True)
source=json.load(open(ASSETS+'/water-surfaces-source.json'))
mask=Image.open(ASSETS+'/water-mask-source.png').convert('L')
# Emission values are stored in sRGB. Recover coverage, drop render dither, and
# inset one source pixel so antialiasing cannot brighten a rice/stone silhouette.
mask=mask.point(lambda x: 0 if x<8 else round((x/255)**2.2*255)).filter(ImageFilter.MinFilter(3))
regions=[
 {'id':'reservoir','bounds':[1374,552,172,104],'atlas':[344,164]},
 {'id':'descent','bounds':[1282,656,162,164],'atlas':[344,0]},
 {'id':'paddies','bounds':[1040,820,344,206],'atlas':[0,0]},
 {'id':'cross-paddy','bounds':[860,892,180,100],'atlas':[0,206]},
]
atlas=Image.new('LA',(516,306),(255,0))
covered=Image.new('L',mask.size,0)
for r in regions:
 x,y,w,h=r['bounds'];patch=mask.crop((x,y,x+w,y+h))
 part=Image.new('LA',(w,h),(255,0));part.putalpha(patch)
 atlas.paste(part,tuple(r['atlas']));covered.paste(patch,(x,y))
assert mask.tobytes()==covered.tobytes(), 'Region layout missed mask pixels'
atlas.save(DEST+'/guaira-water-mask.png',optimize=True)
# Decorative data is separate from the canonical navigation metadata.
channels=[];paddies=[]
for s in source['surfaces']:
 v=s['vertices']
 if 'flowing' in s['name']:
  channels.append({'a':[(v[0][i]+v[1][i])/2 for i in range(3)],'b':[(v[2][i]+v[3][i])/2 for i in range(3)],'edge':[(v[0][i]-v[1][i])*.34 for i in range(3)],'velocity':.55 if s['name'].startswith('Gravity') else .28})
 elif 'paddy' in s['name']:paddies.append([sum(q[i] for q in v)/len(v) for i in range(2)])
contract={'version':1,'sourceSize':[1920,1200],
 'atlasSize':list(atlas.size),'regions':regions,'projection':source['projection'],
 'channels':channels,'paddies':paddies,
 'maskInsetPixels':1,'sourceCommit':'4567ce4c2b6e31aca274ecf605b8e9c1e9993027'}
with open(args.data_output,'w') as f:
 json.dump(contract,f,separators=(',',':'));f.write('\n')
json.dump({'atlasBytes':os.path.getsize(DEST+'/guaira-water-mask.png'),
 'contractBytes':os.path.getsize(args.data_output),
 'decodedAtlasBytes':516*306*4,'scratchCanvasBytes':344*206*4,
 'activeSourcePixels':sum(r['bounds'][2]*r['bounds'][3] for r in regions),
 'maskSourceSHA256':hashlib.sha256(open(ASSETS+'/water-mask-source.png','rb').read()).hexdigest()},
 open(DEST+'/guaira-water-cost.json','w'),indent=2)

print('Packaged',atlas.size,'mask bytes',os.path.getsize(DEST+'/guaira-water-mask.png'))
