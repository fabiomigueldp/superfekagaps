import { CollectibleType, EnemyType, TriggerType, type LevelData } from '../types';
import { TileType } from '../constants';

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
    // Older checked-in levels predate triggers and may omit empty entity lists.
    if (data[key] === undefined) data[key] = [];
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
    if (number(data.timeLimit, 'timeLimit') < 0) fail('timeLimit', 'não pode ser negativo');
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
        const theme = object(data.theme, 'theme');
        if (!Array.isArray(theme.skyGradient) || theme.skyGradient.length !== 2) fail('theme.skyGradient', 'deve conter duas cores');
        (theme.skyGradient as unknown[]).forEach((color, index) => text(color, `theme.skyGradient[${index}]`));
        if (!Array.isArray(theme.layers)) fail('theme.layers', 'deve ser uma lista');
        (theme.layers as unknown[]).forEach((value, index) => {
            const path = `theme.layers[${index}]`;
            const layer = object(value, path);
            oneOf(layer.type, ['clouds', 'mountains', 'hills', 'city', 'castle_wall'], `${path}.type`);
            text(layer.color, `${path}.color`);
            number(layer.scrollFactor, `${path}.scrollFactor`);
            for (const key of ['baseHeight', 'speedX', 'roughness']) {
                if (layer[key] !== undefined) number(layer[key], `${path}.${key}`);
            }
        });
    }

    // Every required field has been checked above; preserve optional metadata as well.
    return data as unknown as LevelData;
}
