import { STAGES } from '../src/adventure/campaign';
import { validateStage } from '../src/adventure/progress';
import { isSolidTile } from '../src/world/tileRules';
import { JOAO, BIEL, CALABREZZO, BOSS_LOOPS, BOSS_WALKS, BARRELS, PRESSURE_BARRELS, SEALS, FOE_FRAMES, WORLD_PALETTE } from '../src/adventure/WorldAssets';
import { CANNONS, NOZZLES } from '../src/adventure/WorldMachineAssets';
const errors = STAGES.flatMap(stage => validateStage(stage).map(e => `${stage.id}: ${e}`));
const frames = [...Object.values(BOSS_LOOPS).flatMap(states => Object.values(states).flat()), ...Object.values(JOAO), ...Object.values(BIEL), ...Object.values(CALABREZZO), ...Object.values(BOSS_WALKS).flat(), ...BARRELS, ...PRESSURE_BARRELS, ...SEALS, ...Object.values(FOE_FRAMES).flat(), ...Object.values(NOZZLES).flat(), ...Object.values(CANNONS).flatMap(poses => Object.values(poses))];
for (const [i, frame] of frames.entries()) {
    if (!frame.length || frame.some(row => row.length !== frame[0].length))
        errors.push(`Sprite ${i}: matriz irregular`);
    for (const row of frame)
        for (const symbol of row)
            if (!(symbol in WORLD_PALETTE))
                errors.push(`Sprite ${i}: símbolo sem paleta ${symbol}`);
}
for (const stage of STAGES) {
    for (const landmark of stage.landmarks ?? []) {
        if (landmark.kind !== 'container' && landmark.kind !== 'tank')
            continue;
        const row = Math.round((landmark.kind === 'container' ? landmark.y - landmark.height : landmark.y) / 16);
        for (let col = Math.floor(landmark.x / 16); col < Math.ceil((landmark.x + landmark.width) / 16); col++)
            if (!isSolidTile(stage.level.tiles[row]?.[col]))
                errors.push(`${stage.id}: topo visual de ${landmark.kind} sem terreno sólido em ${col},${row}`);
    }
    for (const p of stage.pickups)
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x >= stage.level.width * 16 || p.y < 0 || p.y >= stage.level.height * 16)
            errors.push(`${stage.id}: coletável fora do mapa ${p.id}`);
    for (const m of stage.mechanisms)
        if (m.x < 0 || m.x + m.width > stage.level.width * 16 || m.y < 0 || m.y + m.height > stage.level.height * 16)
            errors.push(`${stage.id}: mecanismo fora do mapa ${m.id}`);
}
if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
}
else
    console.log(`World: ${STAGES.length} fases e ${frames.length} frames de sprites validados.`);
