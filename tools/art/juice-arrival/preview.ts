import { drawJuiceFactoryArrival, drawJuiceArrivalAtPortal, drawJuiceArrivalSign, type JuiceArrivalStatus } from '../../../src/adventure/experimental/JuiceFactoryArrivalArt';
import { WorldBackdrop } from '../../../src/adventure/WorldBackdrop';
import { ISLANDS, stageById } from '../../../src/adventure/campaign';
import { WorldLevel } from '../../../src/adventure/WorldPhysics';
import { drawWorldTerrain } from '../../../src/adventure/WorldTerrain';
import { drawLandmarks } from '../../../src/adventure/WorldScenery';
import { drawJuiceIntro } from '../../../src/adventure/experimental/JuiceIntroArt';
import { JuiceIntroDirector } from '../../../src/adventure/experimental/JuiceIntroDirector';
import { drawJuiceLabBackground, drawJuiceLabFloor } from '../../../src/adventure/experimental/JuiceArenaPainter';
import { PLAYER_PALETTE, PLAYER_SPRITES } from '../../../src/assets/playerSpriteSpec';
import { SpriteAtlas } from '../../../src/graphics/pixels';
import { box } from '../../../src/adventure/WorldPainting';

const context = (id: string) => (document.getElementById(id) as HTMLCanvasElement).getContext('2d')!;
const c = context('arrival'), backdrop = new WorldBackdrop(), atlas = new SpriteAtlas();
const stage = stageById('3-3')!, level = new WorldLevel(stage.level);
const camera = {x:1600, y:64}, portal = {x:1776, y:184, width:24, height:40};
function render(status: JuiceArrivalStatus = 'open') {
    c.imageSmoothingEnabled = false;
    backdrop.draw(c, ISLANDS[2], camera.x, camera.y, 0, stage.number);
    drawLandmarks(c, stage, camera.x, camera.y, 0);
    drawJuiceArrivalSign(c, 1688 - camera.x, 224 - camera.y, 'right');
    drawJuiceArrivalAtPortal(c, portal, camera, status);
    drawWorldTerrain(c, level, ISLANDS[2], camera.x, camera.y, 0);
    drawLandmarks(c, stage, camera.x, camera.y, 0, true);
    // Keep the authored checkpoint in front, matching WorldGame's layer order.
    for (const cp of stage.checkpoints) {
        const x = cp.x * 16 - camera.x, y = cp.y * 16 - camera.y;
        box(c, x, y - 35, 2, 35, '#f0dbc0'); box(c, x + 2, y - 34, 15, 10, '#788b9a');
    }
    atlas.draw(c, PLAYER_SPRITES.idle, PLAYER_PALETTE, 1736 - camera.x, 224 - camera.y - 26);
}
render();
document.querySelectorAll<HTMLButtonElement>('[data-status]').forEach(button => button.onclick = () => render(button.dataset.status as JuiceArrivalStatus));
const intro = new JuiceIntroDirector();
for (let i = 0; i < 30; i++) intro.advance(100);
drawJuiceIntro(context('stage'), intro.frame, true);
drawJuiceLabBackground(context('arena'), 0);
drawJuiceLabFloor(context('arena'), 64);
// Read-only browser proof harness; never imported by a game entrypoint.
Object.assign(window, { arrivalProof: { render, drawJuiceFactoryArrival, drawJuiceArrivalSign,
    drawJuiceArrivalAtPortal, portal, camera,
    supportTiles: stage.level.tiles[14].slice(104, 120) } });
