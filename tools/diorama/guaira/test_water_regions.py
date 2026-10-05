"""Focused export tests, including expanded artwork outside the old crop boxes."""
import json
from pathlib import Path
import unittest
from PIL import Image, ImageDraw
import numpy as np
from water_regions import split_visible_mask, pack_regions

ROOT=Path(__file__).resolve().parents[3]
class WaterRegionsTest(unittest.TestCase):
    def verify_roundtrip(self, source):
        regions, size=pack_regions(split_visible_mask(source))
        self.assertEqual(len(regions),4)
        atlas=Image.new('L',size);reconstructed=Image.new('L',source.size)
        for r in regions:
            x,y,w,h=r['bounds'];ax,ay=r['atlas']
            self.assertLessEqual(ax+w,size[0]);self.assertLessEqual(ay+h,size[1])
            atlas.paste(source.crop((x,y,x+w,y+h)),(ax,ay))
        for r in regions:
            x,y,w,h=r['bounds'];ax,ay=r['atlas']
            reconstructed.paste(atlas.crop((ax,ay,ax+w,ay+h)),(x,y))
        self.assertEqual(source.tobytes(),reconstructed.tobytes())
        scratch=max(r['bounds'][2] for r in regions)*max(r['bounds'][3] for r in regions)
        self.assertLess((size[0]*size[1]+scratch)*4,1024*1024)
        # Source rectangles must be disjoint: no repaint doubles an effect.
        coverage=np.zeros((1200,1920),dtype=np.uint8)
        for r in regions:
            x,y,w,h=r['bounds'];coverage[y:y+h,x:x+w]+=1
        self.assertLessEqual(int(coverage.max()),1)
    def test_existing_atlas_roundtrip(self):
        data=json.loads((ROOT/'src/adventure/experimental/guaira/GuairaWaterData.json').read_text())
        atlas=Image.open(ROOT/'public/assets/world/experimental/guaira/guaira-water-mask.png').getchannel('A')
        source=Image.new('L',(1920,1200))
        for r in data['regions']:
            x,y,w,h=r['bounds'];ax,ay=r['atlas'];source.paste(atlas.crop((ax,ay,ax+w,ay+h)),(x,y))
        self.verify_roundtrip(source)
    def test_expanded_shifted_occluded_water(self):
        source=Image.new('L',(1920,1200));draw=ImageDraw.Draw(source)
        for bounds in [(1460,530,1610,620),(1385,635,1490,770),(1075,865,1430,1030),(805,945,1055,1020)]:
            draw.ellipse(bounds,fill=215)
        # Native foreground holdouts stay holes after packing.
        draw.rectangle((1190,890,1214,1040),fill=0)
        self.verify_roundtrip(source)
    def test_empty_mask_rejected(self):
        with self.assertRaisesRegex(ValueError,'empty'):split_visible_mask(Image.new('L',(1920,1200)))
if __name__=='__main__':unittest.main()
