import { CollectibleType, EnemyType, TriggerType, type LevelData } from '../types';
import { TILE_SIZE, TileType } from '../constants';

type DataObject = Record<string, unknown>;

function fail(path: string, message: string): never {
    throw new Error(`Nível inválido: ${path} ${message}.`);
}

function object(value: unknown, path: string): DataObject {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'deve ser um objeto');
    return value as DataObject;
}

function number(value: unknown, path: string, positive = false): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || (positive && value <= 0)) {
        fail(path, positive ? 'deve ser um número positivo' : 'deve ser um número finito');
    }
    return value;
}

function text(value: unknown, path: string): void {
    if (typeof value !== 'string') fail(path, 'deve ser texto');
}

function boolean(value: unknown, path: string): void {
    if (typeof value !== 'boolean') fail(path, 'deve ser verdadeiro ou falso');
}

function vector(value: unknown, path: string): void {
    const point = object(value, path);
    number(point.x, `${path}.x`);
    number(point.y, `${path}.y`);
}

function oneOf(value: unknown, allowed: readonly unknown[], path: string): void {
    if (!allowed.includes(value)) fail(path, `tem um valor desconhecido (${String(value)})`);
}

function array(data: DataObject, key: string): unknown[] {
    if (!Array.isArray(data[key])) fail(key, 'deve ser uma lista');
    return data[key] as unknown[];
}

/** Validate and clone level data without mutating the loaded level or discarding fields. */
export function normalizeLevelData(value: unknown): LevelData {
    object(value, 'DATA');
    // Reject values that JSON would silently change (NaN becomes null, functions disappear).
    let data: DataObject;
    try {
        data = JSON.parse(JSON.stringify(value, (key, item: unknown) => {
            if (key === '__proto__') fail(key, 'não é uma propriedade permitida');
            if (typeof item === 'number' && !Number.isFinite(item)) fail(key, 'deve ser um número finito');
            if (['function', 'symbol', 'bigint'].includes(typeof item)) fail(key, 'não pode ser serializado');
            return item;
        })) as DataObject;
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('Nível inválido:')) throw error;
        throw new Error('Nível inválido: os dados precisam ser serializáveis, sem referências circulares.');
    }

    text(data.id, 'id');
    if (!(data.id as string).trim()) fail('id', 'não pode ficar vazio');
    text(data.name, 'name');
    for (const key of ['width', 'height']) {
        const size = number(data[key], key, true);
        if (!Number.isSafeInteger(size)) fail(key, 'deve ser um inteiro');
    }
    for (const key of ['originX', 'originY']) {
        if (data[key] !== undefined && !Number.isSafeInteger(number(data[key], key))) fail(key, 'deve ser um inteiro');
    }

    if (!Array.isArray(data.tiles) || data.tiles.length !== data.height) fail('tiles', 'deve conter exatamente height linhas');
    const validTiles = new Set(Object.values(TileType).filter(v => typeof v === 'number'));
    (data.tiles as unknown[]).forEach((row, y) => {
        if (!Array.isArray(row) || row.length !== data.width) fail(`tiles[${y}]`, 'deve conter exatamente width colunas');
        (row as unknown[]).forEach((tile, x) => {
            if (typeof tile !== 'number' || !Number.isInteger(tile) || !validTiles.has(tile)) fail(`tiles[${y}][${x}]`, 'contém um tile desconhecido');
        });
    });

    vector(data.playerSpawn, 'playerSpawn');
    vector(data.goalPosition, 'goalPosition');
    number(data.timeLimit, 'timeLimit', true);
    boolean(data.isBossLevel, 'isBossLevel');
    array(data, 'checkpoints').forEach((point, index) => vector(point, `checkpoints[${index}]`));
    for (const [key, types] of [['enemies', Object.values(EnemyType)], ['collectibles', Object.values(CollectibleType)]] as const) {
        array(data, key).forEach((value, index) => {
            const path = `${key}[${index}]`;
            const entity = object(value, path);
            oneOf(entity.type, types, `${path}.type`);
            vector(entity.position, `${path}.position`);
        });
    }

    const triggerIds = new Set<string>();
    array(data, 'triggers').forEach((value, index) => {
        const path = `triggers[${index}]`;
        const trigger = object(value, path);
        text(trigger.id, `${path}.id`);
        const id = trigger.id as string;
        if (!id.trim() || triggerIds.has(id)) fail(`${path}.id`, 'deve ser único e não vazio');
        triggerIds.add(id);
        oneOf(trigger.type, Object.values(TriggerType), `${path}.type`);
        number(trigger.x, `${path}.x`);
        number(trigger.y, `${path}.y`);
        number(trigger.width, `${path}.width`, true);
        number(trigger.height, `${path}.height`, true);
        boolean(trigger.oneShot, `${path}.oneShot`);
        boolean(trigger.active, `${path}.active`);
        switch (trigger.type) {
            case TriggerType.AUDIO:
                text(trigger.trackId, `${path}.trackId`);
                oneOf(trigger.action, ['PLAY', 'STOP'], `${path}.action`);
                break;
            case TriggerType.CAMERA:
                number(trigger.zoom, `${path}.zoom`, true);
                boolean(trigger.lockX, `${path}.lockX`);
                boolean(trigger.lockY, `${path}.lockY`);
                break;
            case TriggerType.DAMAGE:
                if (number(trigger.damagePerTick, `${path}.damagePerTick`) < 0) fail(`${path}.damagePerTick`, 'não pode ser negativo');
                boolean(trigger.instantKill, `${path}.instantKill`);
                break;
            case TriggerType.DIALOG:
                text(trigger.text, `${path}.text`);
                break;
        }
    });

    if (data.theme !== undefined) {
        const validateThemeRegion = (value: unknown, path: string): void => {
            const region = object(value, path);
            if (!Array.isArray(region.skyGradient) || region.skyGradient.length !== 2) fail(`${path}.skyGradient`, 'deve conter duas cores');
            (region.skyGradient as unknown[]).forEach((color, index) => text(color, `${path}.skyGradient[${index}]`));
            if (!Array.isArray(region.layers)) fail(`${path}.layers`, 'deve ser uma lista');
            (region.layers as unknown[]).forEach((layerValue, index) => {
                const layerPath = `${path}.layers[${index}]`;
                const layer = object(layerValue, layerPath);
                oneOf(layer.type, ['clouds', 'mountains', 'hills', 'city', 'castle_wall', 'cavern', 'crystals'], `${layerPath}.type`);
                text(layer.color, `${layerPath}.color`);
                number(layer.scrollFactor, `${layerPath}.scrollFactor`);
                for (const key of ['baseHeight', 'speedX', 'roughness']) {
                    if (layer[key] !== undefined) number(layer[key], `${layerPath}.${key}`);
                }
            });
        };
        const theme = object(data.theme, 'theme');
        if (theme.biome !== undefined) oneOf(theme.biome, ['meadow', 'ember', 'citadel'], 'theme.biome');
        validateThemeRegion(theme, 'theme');
        if (theme.underground !== undefined) {
            const underground = object(theme.underground, 'theme.underground');
            const startRow = number(underground.startRow, 'theme.underground.startRow');
            if (!Number.isSafeInteger(startRow)) fail('theme.underground.startRow', 'deve ser um inteiro');
            validateThemeRegion(underground, 'theme.underground');
        }
    }

    const level = data as unknown as LevelData;
    const minX = level.originX ?? 0;
    const minY = level.originY ?? 0;
    const maxX = minX + level.width;
    const maxY = minY + level.height;
    if (level.theme?.underground &&
        (level.theme.underground.startRow < minY || level.theme.underground.startRow >= maxY)) {
        fail('theme.underground.startRow', 'está fora do mapa');
    }
    const inside = (point: { x: number; y: number }, path: string): void => {
        if (point.x < minX || point.x >= maxX || point.y < minY || point.y >= maxY) fail(path, 'está fora do mapa');
    };
    inside(level.playerSpawn, 'playerSpawn');
    inside(level.goalPosition, 'goalPosition');
    const checkpointPositions = new Set<string>();
    level.checkpoints.forEach((point, index) => {
        inside(point, `checkpoints[${index}]`);
        const key = `${point.x},${point.y}`;
        if (checkpointPositions.has(key)) fail(`checkpoints[${index}]`, 'repete outro checkpoint');
        checkpointPositions.add(key);
    });
    level.enemies.forEach((enemy, index) => inside(enemy.position, `enemies[${index}].position`));
    const collectiblePositions = new Set<string>();
    level.collectibles.forEach((item, index) => {
        inside(item.position, `collectibles[${index}].position`);
        const key = `${item.type}:${item.position.x},${item.position.y}`;
        if (collectiblePositions.has(key)) fail(`collectibles[${index}]`, 'repete outro coletável');
        collectiblePositions.add(key);
    });
    const bossCount = level.enemies.filter(enemy => enemy.type === EnemyType.JOAOZAO).length;
    if (level.isBossLevel && bossCount !== 1) fail('enemies', 'fase de boss precisa ter exatamente um boss');
    if (!level.isBossLevel && bossCount !== 0) fail('isBossLevel', 'deve estar ativo quando há um boss');
    level.triggers.forEach((trigger, index) => {
        if (trigger.x + trigger.width <= minX * TILE_SIZE || trigger.x >= maxX * TILE_SIZE ||
            trigger.y + trigger.height <= minY * TILE_SIZE || trigger.y >= maxY * TILE_SIZE) {
            fail(`triggers[${index}]`, 'não cruza a área do mapa');
        }
    });
    return level;
}
