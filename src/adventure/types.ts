import type { LevelData, Rect, Vector2 } from '../types';
export type Character = 'feka' | 'joao' | 'biel' | 'calabrezzo' | 'yasmin';
export type EncounterId = 'J1' | 'B1' | 'C1' | 'B2' | 'C2' | 'J2';
export type MechanismKind = 'platform' | 'lift' | 'swing' | 'belt' | 'switch' | 'jet' | 'launcher' | 'target' | 'support';
export interface MechanismSpec extends Rect {
    id: string;
    kind: MechanismKind;
    to?: Vector2;
    period?: number;
    phase?: number;
    link?: string;
    direction?: number;
    pressurized?: boolean;
    /** A lift controlled by an encounter, never by the autonomous cable cycle. */
    gated?: boolean;
}
export type FoeKind = 'minion' | 'helmet' | 'charger' | 'loader' | 'agitator' | 'rail';
export interface FoeSpec {
    id: string;
    kind: FoeKind;
    x: number;
    y: number;
    range?: number;
}
export interface Pickup {
    id: string;
    kind: 'coin' | 'seal' | 'helmet' | 'fanta';
    x: number;
    y: number;
}
export interface Exit extends Rect {
    id: 'normal' | 'secret';
    requires?: string;
}
export interface Dialogue {
    id: string;
    x: number;
    speaker: Character;
    text: string;
    clip?: string;
    /** Missing means a first-time blocking scene, including older editor exports. */
    presentation?: 'dialogue' | 'comment';
}
/** Authored scenery is anchored to the same tile geometry as the route. */
export interface Landmark extends Rect {
    kind: 'palms' | 'lighthouse' | 'rope' | 'container' | 'crane' | 'tank' | 'pipe' | 'station' | 'pine' | 'freezer' | 'arch' | 'oven' | 'banner' | 'rockArch' | 'garden' | 'house' | 'bottler';
    label?: string;
    variant?: number;
}
export interface RouteCue {
    x: number;
    y: number;
    /** The player activates this switch before crossing the next authored section. */
    switch?: string;
}
export interface AdventureStage {
    id: string;
    world: number;
    number: number;
    name: string;
    subtitle: string;
    level: LevelData;
    mechanisms: MechanismSpec[];
    foes: FoeSpec[];
    pickups: Pickup[];
    exits: Exit[];
    checkpoints: Vector2[];
    dialogues: Dialogue[];
    encounter?: EncounterId;
    landmarks?: Landmark[];
    route?: RouteCue[];
}
export interface Island {
    id: number;
    name: string;
    accent: string;
    sky: [
        string,
        string
    ];
    soil: [
        string,
        string,
        string
    ];
    map: [
        number,
        number
    ];
    description: string;
    boss: Character;
}
export interface Preferences {
    music: number;
    effects: number;
    voice: number;
    shake: boolean;
}
export interface AdventureSave {
    version: 1;
    completed: string[];
    seals: string[];
    secrets: string[];
    seen: string[];
    selected: string;
    checkpoint: {
        stage: string;
        index: number;
        helmet: boolean;
    } | null;
    times: Record<string, number>;
    preferences: Preferences;
}
export const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
