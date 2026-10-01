"""Original Serra–Reserva passenger carrier, bounded Blender proof only.

blender -b -P tools/diorama/render_passenger_cabin.py -- --route-dx X --route-dy Y
Then reuse that export at the reviewed half size without rerendering:
blender -b -P tools/diorama/render_passenger_cabin.py -- --output-dir DIR --package-half
The imported build_cabin() helper only adds authored geometry to the caller scene.
No runtime or production asset is written. Coordinates are relative to Feka's foot.
"""
import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[2]
PIXEL_MAP_WIDTH = (4.15 / 20.6) * 3 / 384
PIXEL_WORLD = PIXEL_MAP_WIDTH * 20.6
CAMERA_VECTOR = Vector((11, -20.25, 15.25))
# This limit is declared before the geometry. Station authors reserve the full box.
ENVELOPE = {'x': [-.94, .94], 'y': [-.70, .70], 'z': [-.12, 2.70]}
DIMENSIONS = {'floor': [1.62, 1.10, .12], 'roof': [1.84, 1.32, .14],
              'roofUnderside': 1.78, 'cableHeight': 2.60,
              'openDoorX': [-.81, .81], 'doorClearY': [-.47, .47],
              'openWindowZ': [.46, 1.78]}


def material(name, rgb, metal=0):
    rgb = tuple(((v + .055) / 1.055) ** 2.4 if v > .04045 else v / 12.92 for v in rgb)
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = .55
    return m


def cube(name, loc, dims, mat, radius=.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if radius:
        b = obj.modifiers.new('Soft manufactured edge', 'BEVEL')
        b.width = radius
        b.segments = 2
        obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
    return obj


def beam(name, a, b, radius, mat):
    a, b = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=radius, depth=(b-a).length,
                                      location=(a+b)/2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    obj.data.materials.append(mat)
    return obj


def build_cabin(name, foot=(0, 0, 0)):
    """Two open X end doorways; Y front/rear panels; supported cream canopy.

    Rear structural pillars and high cantilever stays support the full roof.
    There are no foreground pillars through the boarding sightline.
    """
    foot = Vector(foot)
    red = material(name+' enamel red', (.82, .19, .15))
    cream = material(name+' warm cream', (.97, .88, .64))
    steel = material(name+' charcoal running gear', (.20, .26, .29), .35)
    floor_mat = material(name+' worn tan floor', (.52, .38, .23))
    objects = []

    def box(label, loc, dims, mat, layer='rear', radius=.025):
        obj = cube(name+' '+label, foot+Vector(loc), dims, mat, radius)
        obj['cabinLayer'] = layer
        objects.append(obj)
        return obj

    def rod(label, a, b, radius, mat, layer='rear'):
        obj = beam(name+' '+label, foot+Vector(a), foot+Vector(b), radius, mat)
        obj['cabinLayer'] = layer
        objects.append(obj)
        return obj

    box('continuous supported floor', (0, 0, -.06), DIMENSIONS['floor'], floor_mat)
    for yy in [-.37, .37]:
        box('underfloor stringer', (0, yy, -.095), (1.61, .11, .05), steel)
    for yy, label, layer in [(-.53, 'near', 'foreground'), (.53, 'far', 'rear')]:
        box(label+' red lower panel', (0, yy, .22), (1.62, .07, .44), red, layer)
        box(label+' cream window sill', (0, yy, .455), (1.67, .085, .055), cream, layer, .012)
    for xx in [-.76, .76]:
        box('rear cream structural pillar', (xx, .53, 1.11), (.075, .08, 1.34), cream)
        # The diagonal stays are entirely above the actor's source-pixel head.
        rod('upper canopy cantilever stay', (xx, .53, 1.49), (xx, -.52, 1.81), .035, cream)
    box('cream canopy', (0, 0, 1.85), DIMENSIONS['roof'], cream, 'foreground', .05)
    box('red roof cap', (0, 0, 1.935), (1.72, 1.19, .05), red, 'foreground', .035)
    # Two feet distribute the hanger load into the roof, not into an empty window.
    rod('hanger left roof tie', (-.35, .13, 1.95), (0, .13, 2.18), .042, steel)
    rod('hanger right roof tie', (.35, .13, 1.95), (0, .13, 2.18), .042, steel)
    rod('upright hanger', (0, .13, 2.18), (0, .13, 2.59), .047, steel)
    box('cable carriage', (0, .13, 2.61), (.39, .24, .14), steel)
    for xx in [-.11, .11]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=.09, depth=.08,
                                          location=foot+Vector((xx, .13, 2.60)),
                                          rotation=(math.pi/2, 0, 0))
        obj = bpy.context.object
        obj.name = name+' carriage wheel'
        obj.data.materials.append(cream)
        obj['cabinLayer'] = 'rear'
        objects.append(obj)
    # Restrained finish, inside the frozen box: actual panel seams and fasteners.
    box('near lower panel edge seam', (0, -.572, .042), (1.55, .018, .027), steel, 'foreground', .006)
    for xx in [-.795, .795]:
        box('flush doorway floor nosing', (xx, 0, -.037), (.024, 1.04, .068), cream, 'rear', .006)
    for xx in [-.72, .72]:
        for zz in [.10, .35]:
            bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=.018, depth=.015,
                                              location=foot+Vector((xx,-.576,zz)),
                                              rotation=(math.pi/2,0,0))
            obj = bpy.context.object
            obj.name = name+' near panel functional rivet'
            obj.data.materials.append(cream)
            obj['cabinLayer'] = 'foreground'
            objects.append(obj)
    for xx in [-.76, .76]:
        for zz in [.58, 1.69]:
            bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=.024, depth=.018,
                                              location=foot+Vector((xx,.481,zz)),
                                              rotation=(math.pi/2,0,0))
            obj = bpy.context.object
            obj.name = name+' rear pillar joint bolt'
            obj.data.materials.append(steel)
            obj['cabinLayer'] = 'rear'
            objects.append(obj)
    # Small authored mountain/cold badge; no text and no external artwork.
    box('mountain badge backing', (0,-.581,.235), (.32,.022,.24), steel, 'foreground', .03)
    emblem_verts = [(-.125,-.596,.155),(-.025,-.596,.326),(.072,-.596,.155),
                   (.003,-.597,.155),(.072,-.597,.274),(.139,-.597,.155)]
    me = bpy.data.meshes.new(name+' mountain emblem geometry')
    me.from_pydata([foot+Vector(v) for v in emblem_verts], [], [(0,1,2),(3,4,5)])
    me.update()
    obj = bpy.data.objects.new(name+' cream twin mountain emblem',me)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(cream)
    obj['cabinLayer'] = 'foreground'
    objects.append(obj)
    for obj in objects:
        obj['passengerCarrier'] = name
        # Keep the roof and the assembly physically above it in one depth pass.
        # Splitting ties behind the roof would paint the roof over their tops.
        if any(part in obj.name for part in ['hanger', 'cable carriage', 'carriage wheel']):
            obj['cabinLayer'] = 'foreground'
    return objects


def make_feka(name, foot, camera, source):
    """Exact source pixels, upright in world depth, same fixed map scale."""
    colors = dict(re.findall(r"(\w+):\s*'(#[0-9a-fA-F]{6})'", (ROOT/'src/graphics/palette.ts').read_text()))
    mapping = dict(re.findall(r'(\w): ART\.(\w+)', (ROOT/'src/assets/playerSpriteSpec.ts').read_text()))
    basis = camera.rotation_euler.to_matrix()
    right, up, toward = [basis @ Vector(v) for v in [(1,0,0), (0,1,0), (0,0,1)]]
    mats = {}
    for symbol, key in mapping.items():
        code = colors[key][1:]
        mat = material(name+' original pixel '+symbol, tuple(int(code[i:i+2], 16)/255 for i in (0,2,4)))
        nodes = mat.node_tree.nodes
        nodes.clear()
        emission = nodes.new('ShaderNodeEmission')
        emission.inputs[0].default_value = mat.diffuse_color
        output = nodes.new('ShaderNodeOutputMaterial')
        mat.node_tree.links.new(emission.outputs[0], output.inputs['Surface'])
        mats[symbol] = mat
    by_material = {}
    for y, row in enumerate(source['frames']['idle']):
        for x, symbol in enumerate(row):
            if symbol == '_':
                continue
            a = Vector(foot)+toward*.004+right*((x-8)*PIXEL_WORLD)+Vector((0,0,(25-y)*PIXEL_WORLD/up.z))
            verts, faces = by_material.setdefault(symbol, ([], []))
            n = len(verts)
            verts.extend([a, a+right*PIXEL_WORLD,
                          a+right*PIXEL_WORLD+Vector((0,0,PIXEL_WORLD/up.z)),
                          a+Vector((0,0,PIXEL_WORLD/up.z))])
            faces.append((n,n+1,n+2,n+3))
    for symbol, (verts, faces) in by_material.items():
        me = bpy.data.meshes.new(name+' exact Feka pixels')
        me.from_pydata(verts, [], faces)
        me.update()
        obj = bpy.data.objects.new(name+' original Feka '+symbol, me)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(mats[symbol])


def mesh_model(objects, origin):
    deps = bpy.context.evaluated_depsgraph_get()
    verts, tris, names = [], [], []
    for obj in objects:
        evaluated = obj.evaluated_get(deps)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        start = len(verts)
        verts.extend(obj.matrix_world @ vertex.co-Vector(origin) for vertex in mesh.vertices)
        for tri in mesh.loop_triangles:
            tris.append(tuple(start+i for i in tri.vertices))
            names.append(obj.name)
        evaluated.to_mesh_clear()
    return BVHTree.FromPolygons(verts, tris, all_triangles=True), names, verts


def package_half(out):
    """Package the already verified 8× layers at 4× without rerendering."""
    from PIL import Image
    export = Path(out)/'export'
    original = export/'source-8px'
    original.mkdir(exist_ok=True)
    files = ['reserva-passenger-cabin.webp', 'reserva-passenger-cabin.png',
             'passenger-cabin-atlas.meta.json', 'passenger-layer-composite-feka.png']
    for filename in files:
        if not (original/filename).exists():
            shutil.copy2(export/filename, original/filename)
    delivery = json.loads((original/'passenger-cabin-atlas.meta.json').read_text())
    old_frame = delivery['frame']
    assert old_frame['width'] == 556 and old_frame['height'] == 740 and old_frame['passengerPixelScale'] == 8
    native = Image.open(original/'reserva-passenger-cabin.webp').convert('RGBA')
    width,height = 278,370
    rear = native.crop((0,0,556,740)).resize((width,height),Image.Resampling.LANCZOS)
    fore = native.crop((556,0,1112,740)).resize((width,height),Image.Resampling.LANCZOS)
    atlas = Image.new('RGBA',(width*2,height))
    atlas.paste(rear,(0,0))
    atlas.paste(fore,(width,0))
    atlas.save(export/'reserva-passenger-cabin.webp',lossless=True,method=6)
    atlas.save(export/'reserva-passenger-cabin.png')
    frame = {**old_frame,'width':width,'height':height,'passengerPixelScale':4.0,
             'passengerFoot':{k:v/2 for k,v in old_frame['passengerFoot'].items()},
             'rear':{'x':0,'y':0,'w':width,'h':height},
             'foreground':{'x':width,'y':0,'w':width,'h':height}}
    assert abs(frame['widthInMap']*frame['passengerPixelScale']/width-PIXEL_MAP_WIDTH)<1e-14
    delivery['frame'] = frame
    delivery['atlas']['width'],delivery['atlas']['height'] = width*2,height
    delivery['export']['packaging'] = {'resize':.5,'filter':'Lanczos; layers resized separately',
                                       'originalDirectory':'source-8px','rerendered':False}
    (export/'passenger-cabin-atlas.meta.json').write_text(json.dumps(delivery,indent=2)+'\n')
    source = json.loads((Path(out)/'feka-sprite-source.json').read_text())
    colors = dict(re.findall(r"(\w+):\s*'(#[0-9a-fA-F]{6})'",(ROOT/'src/graphics/palette.ts').read_text()))
    mapping = dict(re.findall(r'(\w): ART\.(\w+)',(ROOT/'src/assets/playerSpriteSpec.ts').read_text()))
    hero = Image.new('RGBA',(16,26))
    for yy,row in enumerate(source['frames']['idle']):
        for xx,symbol in enumerate(row):
            if symbol!='_':
                code=colors[mapping[symbol]][1:]
                hero.putpixel((xx,yy),tuple(int(code[i:i+2],16) for i in (0,2,4))+(255,))
    proof = rear.copy()
    proof.alpha_composite(hero.resize((64,104),Image.Resampling.NEAREST),
                          (round(frame['passengerFoot']['x']-32),round(frame['passengerFoot']['y']-104)))
    proof = Image.alpha_composite(proof,fore)
    proof.save(export/'passenger-layer-composite-feka.png')
    # The released desktop audit uses a 1180-pixel-wide atlas island frame.
    # Match runtime by drawing cabin layers smoothly and original Feka pixels
    # at rounded positions with ceil-sized pixel cells at the screen scale.
    from PIL import ImageDraw
    map_width = 1180
    scale = frame['widthInMap']*map_width/width
    screen_size = (round(width*scale),round(height*scale))
    screen = rear.resize(screen_size,Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(screen)
    fx,fy = (frame['passengerFoot'][k]*scale for k in ['x','y'])
    pixel_scale = map_width*PIXEL_MAP_WIDTH
    cell = math.ceil(pixel_scale)
    for yy,row in enumerate(source['frames']['idle']):
        for xx,symbol in enumerate(row):
            if symbol!='_':
                x=math.floor(fx+(xx-8)*pixel_scale+.5)
                y=math.floor(fy+(yy-26)*pixel_scale+.5)
                draw.rectangle((x,y,x+cell-1,y+cell-1),fill=colors[mapping[symbol]])
    screen = Image.alpha_composite(screen,fore.resize(screen_size,Image.Resampling.LANCZOS))
    panel = Image.new('RGBA',(180,220),'#3e5662')
    panel.alpha_composite(screen,((180-screen_size[0])//2,(220-screen_size[1])//2))
    panel.save(export/'passenger-at-map-scale-1180.png')
    print('PASSENGER_HALF_PACKAGE='+json.dumps({'bytes':(export/'reserva-passenger-cabin.webp').stat().st_size,
                                               'atlas':delivery['atlas'],'frame':frame,
                                               'mapScaleProofSize':screen_size}),flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', default='/tmp/feka-passenger-cabin')
    parser.add_argument('--route-dx', type=float)
    parser.add_argument('--route-dy', type=float)
    parser.add_argument('--route-dz', type=float, default=-4.1)
    parser.add_argument('--lane-spacing', type=float, default=4.5)
    parser.add_argument('--ortho-scale', type=float, default=8.8)
    parser.add_argument('--samples', type=int, default=8)
    parser.add_argument('--build-only', action='store_true')
    parser.add_argument('--export-layers', action='store_true')
    parser.add_argument('--package-half', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    if args.package_half:
        package_half(out)
        return
    if args.route_dx is None or args.route_dy is None:
        parser.error('--route-dx and --route-dy are required for geometry proofs')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    target = Vector((0,0,1.25))
    bpy.ops.object.camera_add(location=target+CAMERA_VECTOR)
    camera = bpy.context.object
    camera.rotation_euler = (-CAMERA_VECTOR).to_track_quat('-Z','Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = args.ortho_scale
    scene.camera = camera
    basis = camera.rotation_euler.to_matrix()
    right, up, toward = [basis @ Vector(v) for v in [(1,0,0),(0,1,0),(0,0,1)]]
    delta = Vector((args.route_dx, args.route_dy, args.route_dz))
    # Final link contract: lane B is on the outboard east/north side of lane A.
    perp = Vector((delta.y, -delta.x, 0)).normalized()
    feet = [-perp*args.lane_spacing/2, perp*args.lane_spacing/2]
    carriers = [build_cabin('passenger carrier '+name, foot) for name, foot in zip(['A','B'], feet)]
    source = json.loads(subprocess.check_output(['node', str(ROOT/'tools/diorama/export_serra_sprite.mjs')], text=True))
    assert abs(source['pixelMapWidth']-PIXEL_MAP_WIDTH) < 1e-14
    (out/'feka-sprite-source.json').write_text(json.dumps(source, indent=2)+'\n')
    line_mat = material('Overhead proof cable', (.22,.26,.30), .4)
    along = Vector((delta.x,delta.y,0)).normalized()
    for name, foot in zip(['A','B'],feet):
        anchor = foot+Vector((0,.13,2.60))
        beam('proof cable '+name, anchor-along*2.5, anchor+along*2.5, .021, line_mat)
        make_feka('proof '+name, foot, camera, source)
    world = bpy.data.worlds.new('Soft neutral proof world')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (.65,.72,.80,1)
    world.node_tree.nodes['Background'].inputs[1].default_value = .65
    for loc, energy, size in [((-6,-9,12),1800,7), ((7,3,9),1250,6)]:
        bpy.ops.object.light_add(type='AREA', location=loc)
        light = bpy.context.object
        light.data.energy = energy
        light.data.size = size
        light.rotation_euler = (target-light.location).to_track_quat('-Z','Y').to_euler()
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = args.samples
    scene.cycles.use_denoising = False
    scene.cycles.max_bounces = 4
    scene.render.resolution_x = 1120
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.film_transparent = True
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = .3
    bpy.context.view_layer.update()
    model, names, vertices = mesh_model(carriers[0], feet[0])
    actual = {axis:[round(min(v[i] for v in vertices),6), round(max(v[i] for v in vertices),6)]
              for i,axis in enumerate(['x','y','z'])}
    for axis in ENVELOPE:
        assert actual[axis][0] >= ENVELOPE[axis][0]-1e-6 and actual[axis][1] <= ENVELOPE[axis][1]+1e-6, (axis,actual)
    projected = {'x':[min(v.dot(right) for v in vertices),max(v.dot(right) for v in vertices)],
                 'y':[min(v.dot(up) for v in vertices),max(v.dot(up) for v in vertices)]}
    # One focused union check over exact idle/walk head pixels and both facings.
    # The sweep covers counterpart approach, passing and departure at <= .08 units.
    head = set()
    for frame, rows in source['frames'].items():
        hy = 1 if frame in ['walk2','walk5'] else 0
        for y,row in enumerate(rows):
            for x,symbol in enumerate(row):
                if symbol!='_' and y <= hy+11 and 3 <= x <= 14:
                    for flip in [False,True]:
                        for dx,dy in [(.12,.12),(.88,.12),(.12,.88),(.88,.88),(.5,.5)]:
                            head.add((15-x+dx-8 if flip else x+dx-8,26-y-dy))
    head = [right*(x*PIXEL_WORLD)+Vector((0,0,y*PIXEL_WORLD/up.z)) for x,y in head]
    own_hits, boarding_hits, other_hits = {}, {}, {}
    for offset in head:
        hit,_,idx,_ = model.ray_cast(offset+toward*.012,toward,30)
        if hit is not None:
            own_hits[names[idx]] = own_hits.get(names[idx],0)+1
    for x in [-1.20+i*.06 for i in range(41)]:
        for offset in head:
            hit,_,idx,_ = model.ray_cast(Vector((x,0,0))+offset+toward*.012,toward,30)
            if hit is not None:
                boarding_hits[names[idx]] = boarding_hits.get(names[idx],0)+1
    n = max(2, math.ceil(delta.length/.08))
    projected_overlap_poses = 0
    for lane in [0,1]:
        for i in range(n+1):
            t = i/n
            relative = feet[lane]-feet[1-lane]+delta*(2*t-1)
            if lane == 0 and abs(relative.dot(right)) < projected['x'][1]-projected['x'][0] and abs(relative.dot(up)) < projected['y'][1]-projected['y'][0]:
                projected_overlap_poses += 1
            for offset in head:
                hit,_,idx,_ = model.ray_cast(relative+offset+toward*.012,toward,80)
                if hit is not None:
                    other_hits[names[idx]] = other_hits.get(names[idx],0)+1
    meta = {'status':'bounded prototype; no production installation', 'source':str(Path(__file__).relative_to(ROOT)),
            'declaredEnvelope':ENVELOPE,'actualEnvelope':actual,'dimensions':DIMENSIONS,
            'projectedEnvelopeWorld':projected,'cameraVector':list(CAMERA_VECTOR),
            'proofCameraOrthoScale':args.ortho_scale,'mapOrthoScale':20.6,
            'routeDelta':list(delta),'laneSpacing':args.lane_spacing,'laneNormal':list(perp),
            'pairFeet': [list(foot) for foot in feet],
            'passing': {'screenRightSeparation':(feet[1]-feet[0]).dot(right),
                        'screenUpSeparation':(feet[1]-feet[0]).dot(up),
                        'horizontalSilhouetteGap':abs((feet[1]-feet[0]).dot(right))-(projected['x'][1]-projected['x'][0]),
                        'depthTowardCameraBMinusA':(feet[1]-feet[0]).dot(toward),
                        'crossingPaintOrder':['b','a'],
                        'projectedRectangleOverlapPoses':projected_overlap_poses},
            'feka':{'source':source['source'],'worldPixelWidth':PIXEL_WORLD,
                    'pixelMapWidth':PIXEL_MAP_WIDTH,'grid':[16,26],
                    'projectedHeightWorld':26*PIXEL_WORLD,'uprightHeightWorld':26*PIXEL_WORLD/up.z},
            'focusedHeadCheck':{'headRayCountPerPose':len(head),'ownHeadHits':own_hits,
                                'boardingHeadHits':boarding_hits,'countercarHeadHits':other_hits,
                                'countercarPosesPerLane':n+1,'boardingPoses':41,
                                'method':'Real idle/walk source-pixel union, both facings, five subpixel rays; actual evaluated mesh.'},
            'boardingContract':{'footLocal':[0,0,0], 'doors':[[x,0,0] for x in DIMENSIONS['openDoorX']],
                                'staging': [[-1.20,0,0],[1.20,0,0]],
                                'stationLipEnds': [[-.81,0,0],[.81,0,0]],
                                'floorTop':0,'lipTop':0,'minimumLipWidth':.84,
                                'note':'Station lips must reach the real floor at either X end; floor spans ±.81. No decorative object or railing in the center Y±.42 walking lane.'},
            'layerContract':{'paintOrder':['rear','original Feka at passengerFoot','foreground'],
                             'rear':'floor, far panel/sill, structural pillars/stays',
                             'foreground':'near lower panel/sill, canopy and complete hanger/running gear assembly',
                             'ratioInvariant':'widthInMap * passengerPixelScale / frame.width == (4.15 / 20.6) * 3 / 384'},
            'limitations':'Prototype carrier/boarding head geometry only. Full terminal scenery, exact cross-map route, screen raster phase and runtime integration need final review.'}
    (out/'passenger-cabin.meta.json').write_text(json.dumps(meta,indent=2)+'\n')
    scene['passenger_cabin_metadata'] = json.dumps(meta)
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'passenger-cabin.blend'))
    print('PASSENGER_ENVELOPE='+json.dumps(actual),flush=True)
    print('PASSENGER_FOCUSED_CHECK='+json.dumps(meta['focusedHeadCheck']),flush=True)
    if not args.build_only:
        scene.render.filepath = str(out/'passenger-passing-proof.png')
        bpy.ops.render.render(write_still=True)
        print('PASSENGER_PROOF='+scene.render.filepath,flush=True)
    if args.export_layers:
        assert not own_hits and not boarding_hits and not other_hits, 'Do not export a blocked head contract'
        # One final export at eight native pixels per original Feka pixel.
        # The optional reference cables and both proof actors are excluded.
        from PIL import Image
        export = out/'export'
        export.mkdir(exist_ok=True)
        scene.render.resolution_x = 1024
        scene.render.resolution_y = 1024
        scene.cycles.samples = 32
        camera.data.ortho_scale = 4.15
        visual_mid = (projected['y'][0]+projected['y'][1])/2
        camera.location = feet[0]+up*visual_mid+CAMERA_VECTOR
        bpy.context.view_layer.update()
        foot_projection = world_to_camera_view(scene,camera,feet[0])
        foot_px = (foot_projection.x*1024, (1-foot_projection.y)*1024)
        for layer in ['rear','foreground']:
            wanted = {obj for obj in carriers[0] if obj['cabinLayer']==layer}
            for obj in scene.objects:
                obj.hide_render = obj.type not in {'LIGHT','CAMERA'} and obj not in wanted
            scene.render.filepath = str(export/('passenger-'+layer+'-full.png'))
            bpy.ops.render.render(write_still=True)
        rear = Image.open(export/'passenger-rear-full.png').convert('RGBA')
        fore = Image.open(export/'passenger-foreground-full.png').convert('RGBA')
        composite = Image.alpha_composite(rear,fore)
        left,top,right_px,bottom = composite.getbbox()
        left,top,right_px,bottom = max(0,left-4),max(0,top-4),min(1024,right_px+4),min(1024,bottom+4)
        width,height = right_px-left,bottom-top
        atlas = Image.new('RGBA',(2*width,height))
        atlas.paste(rear.crop((left,top,right_px,bottom)),(0,0))
        atlas.paste(fore.crop((left,top,right_px,bottom)),(width,0))
        atlas.save(export/'reserva-passenger-cabin.webp',lossless=True,method=6)
        atlas.save(export/'reserva-passenger-cabin.png')
        frame = {'width':width,'height':height,'widthInMap':width/1024*4.15/20.6,
                 'passengerFoot':{'x':foot_px[0]-left,'y':foot_px[1]-top},
                 'passengerPixelScale':8.0,
                 'rear':{'x':0,'y':0,'w':width,'h':height},
                 'foreground':{'x':width,'y':0,'w':width,'h':height}}
        assert abs(frame['widthInMap']*frame['passengerPixelScale']/width-PIXEL_MAP_WIDTH)<1e-14
        assert 0 <= frame['passengerFoot']['x'] <= width and 0 <= frame['passengerFoot']['y'] <= height
        delivery = {'atlas':{'path':'/assets/world/map/reserva-passenger-cabin.webp',
                             'width':2*width,'height':height},'frame':frame,
                    'source':'tools/diorama/render_passenger_cabin.py',
                    'status':'reviewed cabin geometry; scratch export only',
                    'export':{'samples':32,'projectionOrthoScale':4.15,'sourceSize':[1024,1024],
                              'crop':[left,top,right_px,bottom],
                              'contains':'cabin, hanger, grip only; no cable, actor, station, scenery'},
                    'boardingContract':meta['boardingContract'],
                    'physicalEnvelope':actual,'projectedEnvelopeWorld':projected}
        (export/'passenger-cabin-atlas.meta.json').write_text(json.dumps(delivery,indent=2)+'\n')
        # Exact eventual draw order: rear, original 8× source sprite, foreground.
        colors = dict(re.findall(r"(\w+):\s*'(#[0-9a-fA-F]{6})'",(ROOT/'src/graphics/palette.ts').read_text()))
        mapping = dict(re.findall(r'(\w): ART\.(\w+)',(ROOT/'src/assets/playerSpriteSpec.ts').read_text()))
        hero = Image.new('RGBA',(16,26))
        for yy,row in enumerate(source['frames']['idle']):
            for xx,symbol in enumerate(row):
                if symbol != '_':
                    code=colors[mapping[symbol]][1:]
                    hero.putpixel((xx,yy),tuple(int(code[i:i+2],16) for i in (0,2,4))+(255,))
        proof = rear.crop((left,top,right_px,bottom))
        hero = hero.resize((128,208),Image.Resampling.NEAREST)
        proof.alpha_composite(hero,(round(frame['passengerFoot']['x']-64),round(frame['passengerFoot']['y']-208)))
        proof = Image.alpha_composite(proof,fore.crop((left,top,right_px,bottom)))
        proof.save(export/'passenger-layer-composite-feka.png')
        print('PASSENGER_ATLAS='+str(export/'passenger-cabin-atlas.meta.json'),flush=True)


if __name__ == '__main__':
    main()
