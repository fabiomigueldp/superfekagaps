"""Rebuild Costa v6 entirely from Python sources; no .blend input is required.
Blender: blender -b -t 10 -P render_costa_v6.py -- \
  --repo-root /path/to/repo --output-dir /tmp/costa-v6 [--no-render] [--save-scene]
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import bpy


def arguments():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo-root',required=True,type=Path)
    parser.add_argument('--output-dir',required=True,type=Path)
    parser.add_argument('--no-render',action='store_true',help='Build and validate without invoking Cycles')
    parser.add_argument('--preview',action='store_true',help='Render 960x600 rather than 1920x1200')
    parser.add_argument('--save-scene',action='store_true',help='Retain generated costa-v6.blend in output-dir')
    parser.add_argument('--keep-intermediates',action='store_true',help='Retain procedural staging files and .blend checkpoints for debugging')
    parser.add_argument('--shadow',action='store_true',help='Also render the optional shadow fallback; not required by current atlas runtime')
    argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    return parser.parse_args(argv)


def main():
    args=arguments();repo=args.repo_root.expanduser().resolve();out=args.output_dir.expanduser().resolve()
    assets=repo/'public/assets/world/map'
    inputs={
        'base-costa.meta.json':assets/'costa-diorama.meta.json',
        'base-coast-port-journey.meta.json':assets/'coast-port-journey.meta.json',
    }
    for path in inputs.values():
        if not path.is_file():raise FileNotFoundError('Required route contract not found: '+str(path))
    sources=Path(__file__).resolve().parent/'costa_source'
    if not (sources/'source/render_costa.py').is_file():raise FileNotFoundError('Place costa_source beside this driver')
    out.mkdir(parents=True,exist_ok=True)
    work=Path(tempfile.mkdtemp(prefix='costa-v6-stages-',dir=out))
    shutil.copytree(sources,work,dirs_exist_ok=True)
    for name,path in inputs.items():shutil.copy2(path,work/name)
    os.environ['FEKA_REPO_ROOT']=str(repo);os.environ['FEKA_OUTPUT_DIR']=str(work);os.environ['FEKA_RENDER_ACTIVE']='0'
    original_argv=sys.argv[:]
    # Original checkpoints reset Blender's orphan datablocks exactly as the
    # historical sequence did. They are generated scratch files, never inputs.
    stages=[
        ('build_prototype.py',None,'costa-enrichment-prototype.blend'),
        ('build_bolder_costa.py','costa-enrichment-prototype.blend','costa-enrichment-prototype-v3.blend'),
        ('naturalize_costa.py','costa-enrichment-prototype-v3.blend','costa-enrichment-prototype-v4.blend'),
        ('refine_rock_and_leaf_shapes.py','costa-enrichment-prototype-v4.blend','costa-enrichment-prototype-v5.blend'),
    ]
    receipt={'inputBlendFiles':[],'sourceOnly':True,'renderRequested':not args.no_render,'stages':[],'metadata':{name:hashlib.sha256(path.read_bytes()).hexdigest() for name,path in inputs.items()}}
    def run(name):
        file=work/name
        print('COSTA_SOURCE_STAGE='+name,flush=True)
        exec(compile(file.read_text(),str(file),'exec'),{'__file__':str(file),'__name__':'__main__'})
    try:
        for script,before,after in stages:
            if before:bpy.ops.wm.open_mainfile(filepath=str(work/before))
            run(script)
            if not (work/after).is_file():raise RuntimeError('Stage did not create expected checkpoint: '+after)
            receipt['stages'].append(script)
        shutil.copy2(work/'costa-enrichment-prototype-v5.blend',work/'base-v5.blend')
        bpy.ops.wm.open_mainfile(filepath=str(work/'base-v5.blend'))
        os.environ['FEKA_RENDER_ACTIVE']='0' if args.no_render else '1'
        if not args.preview and '--final' not in sys.argv:sys.argv=original_argv+['--final']
        run('build_costa_v6.py');receipt['stages'].append('build_costa_v6.py')
        # Always perform local route/support/dock validation, even without render.
        run('validate_costa_v6.py')
        if args.shadow and not args.no_render:
            bpy.ops.wm.open_mainfile(filepath=str(work/'costa-v6.blend'))
            run('render_shadow_v6.py')
        deliver=['costa-v6-audit.json','independent-validation.json','base-costa.meta.json','base-coast-port-journey.meta.json']
        if not args.no_render:deliver.append('costa-v6-preview.png' if args.preview else 'costa-v6-final.png')
        if args.shadow and not args.no_render:deliver.append('costa-v6-shadow.png')
        if args.save_scene:deliver.append('costa-v6.blend')
        receipt['outputFiles']={}
        for name in deliver:
            src=work/name
            if not src.is_file():raise FileNotFoundError('Expected output missing: '+name)
            dest=out/name;shutil.copy2(src,dest)
            receipt['outputFiles'][name]={'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
        receipt['status']='passed';receipt['retainedStagingDirectory']=str(work) if args.keep_intermediates else None
        (out/'source-rebuild-receipt.json').write_text(json.dumps(receipt,indent=2))
        print('COSTA_SOURCE_REBUILD_READY='+str(out),flush=True)
    finally:
        sys.argv=original_argv
        if not args.keep_intermediates:shutil.rmtree(work)

if __name__=='__main__':main()
