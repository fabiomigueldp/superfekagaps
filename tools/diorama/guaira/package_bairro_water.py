"""Package this local authored addition without changing distant master pixels.

A full Cycles render physically changes weak indirect light elsewhere. The dry
prop and its nearby contact shadow are retained inside one 80x80 source envelope;
all more distant baseline master pixels and the complete alpha stay exact.

Both masters must be native 1920x1200 RGBA Blender exports from the same camera.
Use the original third-pass master as --baseline, the new fourth-pass export as
--candidate. This is a source-art packaging step, never a runtime overlay.
The regular quality92 WebP encoder may change decoded RGB outside the patch;
its measured codec drift is explicitly included in the audit report.
"""
import argparse,hashlib,json
from pathlib import Path
from PIL import Image
import numpy as np
p=argparse.ArgumentParser();p.add_argument('--baseline',type=Path,required=True);p.add_argument('--candidate',type=Path,required=True);p.add_argument('--baseline-webp',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
a.output.mkdir(parents=True,exist_ok=True)
base=Image.open(a.baseline).convert('RGBA');candidate=Image.open(a.candidate).convert('RGBA');assert base.size==candidate.size==(1920,1200)
b=np.array(base);c=np.array(candidate);assert np.array_equal(b[:,:,3],c[:,:,3]),'Terrain alpha must remain exact'
X,Y,W,H=884,566,80,80;feather=6
# New solid geometry lies safely inside the unfeathered region [899,580,55,54].
yy,xx=np.mgrid[0:H,0:W];edge=np.minimum.reduce([xx,yy,W-1-xx,H-1-yy]);weight=np.clip(edge/feather,0,1);weight=weight*weight*(3-2*weight)
result=b.copy();delta=c[Y:Y+H,X:X+W,:3].astype(float)-b[Y:Y+H,X:X+W,:3]
result[Y:Y+H,X:X+W,:3]=np.rint(b[Y:Y+H,X:X+W,:3]+delta*weight[:,:,None]).clip(0,255).astype('uint8')
img=Image.fromarray(result,'RGBA');img.save(a.output/'guaira-diorama.png');img.save(a.output/'guaira-diorama.webp',quality=92,method=6,exact=True)
old=np.array(Image.open(a.baseline_webp).convert('RGBA'));encoded=np.array(Image.open(a.output/'guaira-diorama.webp').convert('RGBA'));d=np.max(abs(old.astype(int)-encoded.astype(int)),axis=2);outside=np.ones(d.shape,dtype=bool);outside[Y:Y+H,X:X+W]=False
assert np.array_equal(result[outside],b[outside]);assert np.array_equal(encoded[:,:,3],old[:,:,3])
changed=np.any(result!=b,axis=2);ys,xs=np.where(changed);encoded_path=a.output/'guaira-diorama.webp'
report={'sourceSize':[1920,1200],'baseEnvelope':[X,Y,W,H],'shadowEdgeFeatherPixels':feather,'sourceChangedPixels':int(changed.sum()),'sourceChangedBounds':[int(xs.min()),int(ys.min()),int(xs.max()-xs.min()+1),int(ys.max()-ys.min()+1)],'sourceChangedPixelsOutsideEnvelope':int(changed[outside].sum()),'sourceAlphaUnchanged':True,'encodedAlphaUnchanged':True,'baselineEncodedBytes':a.baseline_webp.stat().st_size,'encodedBytes':encoded_path.stat().st_size,'encodedDeltaBytes':encoded_path.stat().st_size-a.baseline_webp.stat().st_size,'encoding':'WebP quality92 method6 exact alpha; unchanged packaging quality','lossyCodecDriftOutsideEnvelope':{'changedPixels':int((d[outside]>0).sum()),'maxChannelDelta':int(d[outside].max()),'pixelsAbove4':int((d[outside]>4).sum()),'pixelsAbove8':int((d[outside]>8).sum()),'meanMaximumChannelDelta':float(d[outside].mean()),'percentilesMaximumChannelDelta':{str(k):float(np.percentile(d[outside],k)) for k in [50,90,95,99,99.9,100]},'nonzeroMeanMaximumChannelDelta':float(d[outside][d[outside]>0].mean()),'explanation':'VP8 lossy re-encoding propagates RGB quantization changes beyond a local master edit. It is codec drift, not source scenery changes. Alpha is exact.'},'sha256':hashlib.sha256(encoded_path.read_bytes()).hexdigest(),'baselineSha256':hashlib.sha256(a.baseline_webp.read_bytes()).hexdigest()}
json.dump(report,open(a.output/'asset-delta.json','w'),indent=2);print(json.dumps(report))
