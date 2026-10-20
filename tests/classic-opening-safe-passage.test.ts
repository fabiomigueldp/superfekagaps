import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DATA } from '../src/data/levels/level_0_world1-1';
import { TriggerController } from '../src/game/TriggerController';
import { TriggerType } from '../src/types';
import { TileType } from '../src/constants';

test('walking beyond the first checkpoint never activates an invisible damage zone', () => {
  const controller = new TriggerController();
  let damageContacts = 0;
  for (let x = 640; x <= 752; x++) {
    const camera = controller.update(1000 / 60, DATA, { x, y: 120, width: 14, height: 24 }, {
      audio: () => false,
      damage: () => { damageContacts++; return true; }
    });
    assert.equal(camera?.type, TriggerType.CAMERA);
  }
  assert.equal(damageContacts, 0);
  assert.deepEqual(DATA.tiles[11].slice(7, 10), Array(3).fill(TileType.SPIKE));
});
