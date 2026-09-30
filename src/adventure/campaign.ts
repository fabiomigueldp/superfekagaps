import { TileType as T } from '../constants';
import { EnemyType } from '../types';
import type { AdventureStage, Island, MechanismSpec, FoeKind, EncounterId, Character, Landmark, Dialogue } from './types';
export const ISLANDS: Island[] = [
    { id: 1, name: 'Costa dos Gaps', accent: '#83d8ba', sky: ['#65bee7', '#c9eddf'], soil: ['#77a84d', '#a17755', '#594c46'], map: [42, 94], description: 'Toda grande aventura começa com um gap.', boss: 'joao' },
    { id: 2, name: 'Porto do Bielzão', accent: '#f6c65c', sky: ['#88b8d2', '#f0d8a4'], soil: ['#ddb170', '#947450', '#39495b'], map: [93, 74], description: 'Carga pesada. Passagem complicada.', boss: 'biel' },
    { id: 3, name: 'Fábrica de Suco', accent: '#cb91ef', sky: ['#76b7d4', '#d8e7df'], soil: ['#a9ced5', '#486778', '#25354d'], map: [139, 108], description: 'Um produto forte. Um visitante insistente.', boss: 'calabrezzo' },
    { id: 4, name: 'Serra Suspensa', accent: '#e5c4f1', sky: ['#86b4da', '#e1def1'], soil: ['#d1d9d9', '#80949d', '#425769'], map: [180, 68], description: 'Bielzão já chegou lá em cima.', boss: 'biel' },
    { id: 5, name: 'Reserva Gelada', accent: '#a7e7fa', sky: ['#416a8f', '#97c3d5'], soil: ['#ddf8f7', '#8cc0d5', '#406c8c'], map: [230, 94], description: 'A mistura ficou ainda mais concentrada.', boss: 'calabrezzo' },
    { id: 6, name: 'Domínio Pizzarino', accent: '#f3be8b', sky: ['#a58dc2', '#f6c69e'], soil: ['#ecd8b1', '#8c8fa2', '#48516c'], map: [281, 65], description: 'Yasmin está logo ali. João também.', boss: 'joao' }
];
const NAMES = [
    ['Pé na Estrada', 'Ponte Bamba', 'Por Baixo do Gap', 'Falésias em Sequência', 'Joãozão na Ponte'],
    ['Carga Chegando', 'Peso e Contrapeso', 'Entre os Contêineres', 'Expediente Pesado', 'Mestre das Cargas'],
    ['Recebimento de Barris', 'Linha de Envase', 'Tanques de Mistura', 'Pressão Máxima', 'Controle de Qualidade'],
    ['Estação de Subida', 'Contrapeso nas Nuvens', 'Cabos Cruzados', 'Travessia do Alto', 'Revanche nas Alturas'],
    ['Estoque a Frio', 'Tubulação Congelada', 'Reserva Especial', 'Choque de Temperatura', 'Calabrezzo: Reserva Especial'],
    ['Jardins Pizzarino', 'Fornos e Passarelas', 'Passagem dos Fundos', 'A Última Travessia', 'O Grande Gap']
];
const ENCOUNTERS: EncounterId[] = ['J1', 'B1', 'C1', 'B2', 'C2', 'J2'];
/** Authoring coordinates use tiles; runtime mechanisms and exits use pixels. No random terrain. */
class Draft {
    s: AdventureStage;
    constructor(w: number, n: number, width = 160) {
        const id = `${w}-${n}`;
        this.s = { id, world: w, number: n, name: NAMES[w - 1][n - 1], subtitle: ISLANDS[w - 1].description,
            level: { id: `world-${id}`, name: NAMES[w - 1][n - 1], width, height: 23, tiles: Array.from({ length: 23 }, () => Array(width).fill(T.EMPTY)), playerSpawn: { x: 3, y: 14 }, enemies: [], collectibles: [], triggers: [], checkpoints: [], goalPosition: { x: width - 4, y: 14 }, timeLimit: 999, isBossLevel: n === 5, theme: { biome: w === 6 ? 'citadel' : w === 5 ? 'ember' : 'meadow', skyGradient: ISLANDS[w - 1].sky, layers: [] } },
            mechanisms: [], foes: [], pickups: [], exits: [{ id: 'normal', x: (width - 4) * 16, y: 14 * 16 - 40, width: 20, height: 40 }], checkpoints: [], dialogues: [] };
        if (n === 5)
            this.ground(0, 14, width);
    }
    ground(x: number, y: number, w: number, t = T.GROUND) {
        for (let r = y; r < 23; r++)
            for (let c = x; c < x + w; c++)
                if (this.s.level.tiles[r]?.[c] !== undefined)
                    this.s.level.tiles[r][c] = t;
        return this;
    }
    gap(x: number, w: number, safe = true) {
        for (let r = 0; r < 23; r++)
            for (let c = x; c < x + w; c++)
                this.s.level.tiles[r][c] = T.EMPTY;
        if (safe)
            this.ground(x, 19, w);
        return this;
    }
    platform(x: number, y: number, w = 3, t = T.PLATFORM) {
        for (let c = x; c < x + w; c++)
            this.s.level.tiles[y][c] = t;
        return this;
    }
    blocks(x: number, y: number, w: number) { return this.platform(x, y, w, T.BRICK_BREAKABLE); }
    stairs(x: number, y = 14) { this.platform(x, y - 2, 3).platform(x + 5, y - 4, 3).platform(x + 10, y - 6, 4); return this; }
    foe(kind: FoeKind, x: number, y = 14, range = 48) { this.s.foes.push({ id: `e${this.s.foes.length}`, kind, x: x * 16, y: y * 16, range }); return this; }
    cp(x: number, y = 14) { this.s.checkpoints.push({ x, y }); return this; }
    item(kind: 'helmet' | 'fanta', x: number, y = 13) { this.s.pickups.push({ id: `${this.s.id}:i${this.s.pickups.length}`, kind, x: x * 16, y: y * 16 }); return this; }
    coins(x: number, y: number, count = 6) {
        for (let i = 0; i < count; i++)
            this.s.pickups.push({ id: `${this.s.id}:c${this.s.pickups.length}`, kind: 'coin', x: (x + i * 2) * 16, y: (y - (i % 3 === 1 ? 1 : 0)) * 16 });
        return this;
    }
    seal(index: number, x: number, y: number) { this.s.pickups.push({ id: `${this.s.id}:s${index}`, kind: 'seal', x: x * 16, y: y * 16 }); return this; }
    m(kind: MechanismSpec['kind'], id: string, x: number, y: number, w: number, h: number, extra: Partial<MechanismSpec> = {}) { this.s.mechanisms.push({ kind, id, x: x * 16, y: y * 16, width: w * 16, height: h * 16, ...extra }); return this; }
    lift(id: string, x: number, y: number, toY: number, link?: string) { return this.m('lift', id, x, y, 4, .5, { to: { x: x * 16, y: toY * 16 }, period: 4000, link }); }
    move(id: string, x: number, y: number, toX: number, toY = y, period = 5000) { return this.m('platform', id, x, y, 4, .5, { to: { x: toX * 16, y: toY * 16 }, period }); }
    sw(id: string, x: number, y: number, link: string) { return this.m('switch', id, x, y - .3, 1.5, .3, { link }); }
    belt(id: string, x: number, y: number, w: number, dir = 1) { return this.m('belt', id, x, y - .2, w, .2, { direction: dir }); }
    jet(id: string, x: number, y = 14, phase = 0) { return this.m('jet', id, x, y - 3, .8, 3, { period: 4200, phase }); }
    ice(x: number, w: number) { return this.platform(x, 14, w, T.ICE); }
    loader(x: number, y = 14, pressurized = false) { return this.m('launcher', `launch${x}`, x, y - 1, 1, 1, { direction: -1, period: 3200, pressurized }); }
    secret(x: number, y: number, requires?: string) { this.s.exits.push({ id: 'secret', x: x * 16, y: y * 16 - 36, width: 20, height: 36, requires }); return this; }
    talk(x: number, speaker: Character, text: string, clip?: string, presentation: Dialogue['presentation'] = 'comment') { this.s.dialogues.push({ id: `${this.s.id}:d${this.s.dialogues.length}`, x: x * 16, speaker, text, clip, presentation }); return this; }
    land(x: number, y: number, w: number, depth = 23 - y) { for (let r = y; r < Math.min(23, y + depth); r++)
        for (let c = x; c < x + w; c++)
            this.s.level.tiles[r][c] = T.GROUND; return this; }
    art(kind: Landmark['kind'], x: number, y: number, width: number, height: number, label?: string, variant = 0) { (this.s.landmarks ??= []).push({ kind, x: x * 16, y: y * 16, width: width * 16, height: height * 16, label, variant }); return this; }
    cue(x: number, y: number, button?: string) { (this.s.route ??= []).push({ x: x * 16, y: y * 16, switch: button }); return this; }
    arc(x: number, y: number, count = 5) { for (let i = 0; i < count; i++)
        this.s.pickups.push({ id: `${this.s.id}:c${this.s.pickups.length}`, kind: 'coin', x: (x + i) * 16, y: (y - Math.sin(i / (count - 1) * Math.PI) * 2) * 16 }); return this; }
    done() { this.s.level.checkpoints = this.s.checkpoints; this.s.level.enemies = this.s.foes.filter(f => f.kind === 'minion').map(f => ({ type: EnemyType.MINION, position: { x: f.x / 16, y: f.y / 16 } })); return this.s; }
}
function course(w: number, n: number): AdventureStage {
    const d = new Draft(w, n, n === 4 ? 184 : 160);
    const accents: Record<number, [Landmark['kind'], number, number, number, number, string?][][]> = {
        1: [[['garden', 8, 14, 7, 1]], [['palms', 3, 14, 8, 6]], [['rockArch', 20, 18, 22, 7]], [['rockArch', 71, 20, 12, 7]]],
        2: [[['crane', 2, 14, 16, 9]], [['container', 5, 17, 8, 3, 'ENTRADA']], [['station', 38, 14, 14, 5, 'RECEBIMENTO']], [['container', 70, 17, 9, 3, '04']]],
        3: [[['station', 1, 14, 13, 6, 'RECEBIMENTO']], [['bottler', 19, 11, 20, 5], ['bottler', 61, 10, 22, 5], ['bottler', 106, 11, 18, 5]], [['station', 53, 14, 12, 6, 'MISTURA']], [['bottler', 3, 13, 11, 4]]],
        4: [[['pine', 5, 14, 7, 6]], [['pine', 6, 14, 10, 8]], [['pine', 77, 13, 8, 7]], [['pine', 151, 11, 8, 8]]],
        5: [[['pipe', 2, 14, 14, 8]], [['freezer', 3, 14, 11, 7, 'MANUTENÇÃO']], [['pipe', 51, 14, 11, 6]], [['pipe', 65, 14, 12, 6]]],
        6: [[['house', 1, 14, 14, 7, 'Y + J'], ['garden', 60, 14, 13, 5]], [['garden', 66, 14, 12, 5]], [['house', 3, 14, 13, 7, 'Y + J']], [['garden', 1, 14, 13, 7]]],
    };
    for (const [kind,x,y,width,height,label] of accents[w][n-1]) d.art(kind,x,y,width,height,label);

    // Routes are built from islands, rooms and manufactured structures, never a continuous filler floor.
    if (w === 1 && n === 1) {
        d.land(0, 14, 18).land(18, 12, 9).land(31, 14, 18).land(49, 11, 12).land(61, 14, 17).land(84, 13, 15).land(99, 11, 10).land(113, 14, 16).land(129, 12, 11).land(143, 14, 17);
        d.land(27, 18, 4).platform(29, 16, 2).land(78, 18, 6).platform(82, 16, 2).land(109, 18, 4).platform(111, 16, 2);
        d.platform(9, 11, 3).blocks(39, 11, 3).platform(67, 11, 4).platform(121, 11, 3).platform(132, 9, 4);
        d.foe('minion', 36, 14, 32).foe('minion', 91, 13, 40).cp(64).cp(116).item('helmet', 65).seal(1, 21, 10).seal(2, 79, 16).seal(3, 133, 7);
        d.arc(25, 10, 7);
        // The second gap's coins dip toward its seal and trace the existing recovery steps.
        for (const [x, y] of [[75, 12], [77, 13], [78, 14.5], [80, 17], [81, 17], [82, 15], [83, 13], [85, 11]])
            d.coins(x, y, 1);
        d.arc(138, 10, 6).coins(4, 12, 3).talk(4, 'feka', 'Yasmin, estou chegando!').talk(74, 'feka', 'A praia lá embaixo também tem caminho.');
        d.art('palms', 5, 14, 8, 7).art('rope', 27, 14, 4, 3).art('palms', 63, 14, 9, 8).art('lighthouse', 129, 12, 8, 12);
        d.cue(22, 12).cue(41, 14).cue(55, 11).cue(70, 14).cue(91, 13).cue(104, 11).cue(121, 14).cue(136, 12);
    }
    if (w === 1 && n === 2) {
        d.land(0, 14, 16).land(31, 13, 10).land(57, 11, 13).land(86, 13, 11).land(113, 10, 13).land(143, 14, 17);
        d.platform(16, 14, 5, T.PLATFORM_FALLING).platform(24, 13, 7, T.PLATFORM_FALLING).platform(41, 13, 5, T.PLATFORM_FALLING).platform(49, 12, 8, T.PLATFORM_FALLING);
        d.platform(70, 11, 5, T.PLATFORM_FALLING).platform(79, 12, 7, T.PLATFORM_FALLING).platform(97, 13, 5, T.PLATFORM_FALLING).platform(106, 11, 7, T.PLATFORM_FALLING).platform(128, 11, 5, T.PLATFORM_FALLING).platform(137, 13, 6, T.PLATFORM_FALLING);
        d.land(16, 20, 15, 3).platform(25, 17, 4).land(70, 20, 16, 3).platform(81, 16, 4).cp(60, 11).cp(116, 10).foe('minion', 36, 13, 26).seal(1, 27, 11).seal(2, 77, 18).seal(3, 130, 9).item('helmet', 61, 10);
        d.arc(20, 11, 6).arc(45, 10, 6).arc(101, 10, 7).art('rope', 16, 14, 15, 5).art('rope', 41, 13, 16, 7).art('rope', 70, 11, 16, 8).art('rope', 97, 13, 16, 7).art('palms', 116, 10, 8, 7).talk(12, 'feka', 'Madeira rangendo? Melhor continuar andando.');
        d.cue(35, 13).cue(62, 11).cue(89, 13).cue(118, 10).cue(147, 14);
    }
    if (w === 1 && n === 3) {
        d.land(0, 14, 17).land(17, 18, 29).land(46, 16, 9).land(55, 13, 14).land(69, 18, 30).land(99, 15, 9).land(108, 12, 15).land(123, 10, 12).land(140, 14, 20);
        d.platform(19, 12, 9).platform(31, 11, 9).platform(43, 12, 9).blocks(26, 15, 4).platform(74, 14, 6).platform(85, 12, 6).platform(95, 11, 6).platform(117, 8, 5).platform(126, 6, 8);
        d.cp(58, 13).cp(111, 12).foe('minion', 36, 18, 55).foe('minion', 87, 18, 50).seal(1, 27, 16).seal(2, 86, 10).seal(3, 120, 6).secret(131, 6).item('helmet', 59, 12).arc(13, 12, 7).arc(68, 11, 7);
        d.art('rope', 17, 12, 35, 4).art('palms', 57, 13, 9, 7).art('lighthouse', 124, 10, 9, 10).talk(13, 'feka', 'Por cima é rápido. Por baixo... vai que tem alguma coisa.');
        d.cue(35, 18).cue(50, 16).cue(62, 13).cue(90, 18).cue(104, 15).cue(115, 12).cue(131, 10).cue(145, 14);
    }
    if (w === 1 && n === 4) {
        d.land(0, 14, 14).land(21, 12, 10).land(38, 10, 11).land(56, 13, 13).land(84, 11, 13).land(109, 14, 12).land(131, 11, 13).land(150, 9, 10).land(166, 14, 18);
        d.platform(14, 14, 4, T.PLATFORM_FALLING).platform(32, 11, 3, T.PLATFORM_FALLING).platform(49, 12, 4, T.PLATFORM_FALLING).platform(69, 13, 6, T.PLATFORM_FALLING).platform(78, 12, 6, T.PLATFORM_FALLING).platform(98, 12, 7, T.PLATFORM_FALLING).platform(122, 13, 5, T.PLATFORM_FALLING).platform(145, 11, 4);
        d.land(69, 20, 15, 3).platform(80, 16, 4).land(121, 19, 10, 4).platform(127, 16, 4).cp(60, 13).cp(113).foe('minion', 44, 10, 32).foe('charger', 138, 11, 50).seal(1, 42, 8).seal(2, 76, 18).seal(3, 153, 7).item('helmet', 61, 12).arc(28, 10, 8).arc(94, 9, 9).art('palms', 57, 13, 10, 7).art('rope', 69, 13, 15, 7).art('lighthouse', 150, 9, 8, 9);
        d.cue(26, 12).cue(44, 10).cue(61, 13).cue(90, 11).cue(115, 14).cue(137, 11).cue(154, 9).cue(172, 14);
    }
    if (w === 2 && n === 1) {
        d.land(0, 14, 17).land(17, 12, 11, 6).land(33, 14, 13).land(46, 11, 10, 7).land(64, 13, 12).land(95, 11, 13, 7).land(108, 14, 15).land(123, 11, 12, 7).land(143, 14, 17);
        d.platform(57, 12, 5).move('p1', 27, 12, 33, 12).move('p2', 76, 13, 92, 11, 5400).platform(136, 12, 4).land(76, 20, 19, 3).platform(91, 17, 4).cp(66, 13).cp(111).foe('helmet', 51, 11, 34).foe('minion', 116, 14, 32).seal(1, 21, 10).seal(2, 88, 18).seal(3, 130, 9).item('helmet', 67, 12).arc(55, 9, 10).coins(97, 9, 4);
        d.art('container', 17, 18, 11, 6, '02').art('container', 46, 18, 10, 7, 'BIEL').art('container', 95, 18, 13, 7, 'CARGA').art('container', 123, 18, 12, 7, '07').art('crane', 70, 13, 24, 10).talk(8, 'biel', 'João avisou que você vinha. A passagem fechou.');
        d.cue(23, 12).cue(39, 14).cue(51, 11).cue(69, 13).cue(99, 11).cue(115, 14).cue(129, 11).cue(148, 14);
    }
    if (w === 2 && n === 2) {
        d.land(0, 14, 25).land(34, 7, 19, 11).land(57, 12, 17).land(83, 6, 19, 12).land(106, 12, 16).land(131, 8, 12, 10).land(146, 14, 14);
        d.lift('l1', 24, 13, 6).sw('s1', 20, 14, 'l1').platform(29, 7, 5).lift('l2', 73, 11, 5).sw('s2', 68, 12, 'l2').platform(78, 6, 5).lift('l3', 121, 11, 7).sw('s3', 116, 12, 'l3').platform(126, 8, 5);
        d.land(25, 20, 9, 3).platform(27, 17, 4).land(74, 20, 9, 3).platform(76, 16, 4).land(122, 20, 9, 3).platform(124, 16, 4).cp(59, 12).cp(108, 12).foe('helmet', 44, 7, 40).foe('charger', 92, 6, 45).seal(1, 39, 5).seal(2, 89, 4).seal(3, 137, 6).item('helmet', 60, 11);
        d.art('crane', 19, 14, 24, 12).art('container', 34, 18, 19, 11, 'PESO').art('container', 131, 18, 12, 10, '08').art('container', 83, 18, 19, 12, 'BIEL').art('crane', 66, 12, 26, 12).art('crane', 114, 12, 23, 11).talk(15, 'feka', 'Uma sentada no botão. Depois, embarcar!', undefined, 'dialogue');
        d.cue(21, 14, 's1').cue(26, 6).cue(42, 7).cue(62, 12).cue(69, 12, 's2').cue(75, 5).cue(92, 6).cue(112, 12).cue(117, 12, 's3').cue(123, 7).cue(137, 8).cue(150, 14);
    }
    if (w === 2 && n === 3) {
        d.land(0, 14, 19).land(19, 11, 13, 7).land(38, 14, 16).land(54, 10, 15, 8).land(76, 13, 15).land(91, 9, 12, 9).land(111, 14, 16).land(127, 11, 12, 7).land(143, 14, 17);
        d.platform(24, 7, 9).move('p1', 32, 11, 38, 12).platform(59, 6, 7).move('p2', 68, 10, 76, 11).platform(96, 5, 10).move('secretLift', 103, 9, 114, 5).platform(116, 5, 14).secret(127, 5);
        d.platform(139, 12, 4);
        d.cp(40).cp(113).foe('helmet', 63, 10, 43).foe('minion', 83, 13, 44).seal(1, 27, 5).seal(2, 62, 4).seal(3, 98, 3).item('helmet', 41).arc(32, 9, 7).arc(103, 7, 9).art('container', 19, 18, 13, 7, '01').art('container', 54, 18, 15, 8, '03').art('container', 91, 18, 12, 9, '05').art('crane', 102, 10, 29, 11);
        d.cue(25, 11).cue(44, 14).cue(62, 10).cue(83, 13).cue(98, 9).cue(116, 14).cue(133, 11).cue(148, 14);
    }
    if (w === 2 && n === 4) {
        d.land(0, 14, 18).land(35, 12, 13, 6).land(48, 9, 14, 9).land(68, 14, 16).land(84, 11, 10, 7).land(114, 10, 16, 8).land(137, 13, 15).land(152, 10, 13, 8).land(170, 14, 14);
        d.move('p1', 18, 13, 31, 12).move('p2', 94, 11, 110, 9).platform(131, 11, 4).platform(166, 12, 4).land(18, 20, 17, 3).platform(31, 17, 4).land(94, 20, 20, 3).platform(110, 17, 4);
        d.cp(70).cp(140, 13).foe('charger', 54, 9, 50).foe('helmet', 120, 10, 38).foe('loader', 159, 10, 32).seal(1, 54, 7).seal(2, 104, 18).seal(3, 158, 8).item('helmet', 71).arc(59, 7, 10).arc(128, 8, 10).art('crane', 17, 14, 23, 11).art('container', 48, 18, 14, 9, 'EXPEDIÇÃO').art('crane', 92, 12, 27, 12).art('container', 114, 18, 16, 8, 'CARGA').art('container', 152, 18, 13, 8, 'BIEL');
        d.cue(41, 12).cue(55, 9).cue(75, 14).cue(89, 11).cue(122, 10).cue(144, 13).cue(158, 10).cue(176, 14);
    }
    if (w === 3 && n === 1) {
        d.land(0, 14, 19).land(19, 12, 14).land(38, 14, 20).land(58, 11, 14).land(78, 14, 17).land(95, 12, 14).land(115, 10, 14).land(135, 14, 25);
        d.belt('b1', 19, 12, 14, -1).loader(31, 12).platform(34, 13, 3).belt('b2', 78, 14, 17).foe('loader', 67, 11).platform(110, 11, 4).platform(130, 12, 4).cp(41).cp(98, 12).jet('j1', 49).foe('agitator', 88, 14).seal(1, 25, 9).seal(2, 64, 8).seal(3, 121, 7).item('helmet', 42).arc(32, 10, 7).arc(70, 9, 9);
        d.art('tank', 19, 12, 10, 10, '01').art('pipe', 33, 14, 6, 5).art('tank', 58, 11, 12, 10, 'ENVASE').art('tank', 115, 10, 13, 9, '03').talk(8, 'calabrezzo', 'Bem-vindo à Fábrica de Suco. Não mexa na mistura.');
        d.cue(26, 12).cue(43, 14).cue(65, 11).cue(85, 14).cue(101, 12).cue(122, 10).cue(142, 14);
    }
    if (w === 3 && n === 2) {
        d.land(0, 14, 17).land(17, 12, 24).land(47, 14, 12).land(59, 11, 27).land(92, 14, 12).land(104, 12, 23).land(133, 14, 27);
        // Observe the first line from a stationary ledge; invert it before mixing belts and hazards.
        d.belt('b1', 21, 12, 20, -1).sw('s1', 14, 14, 'b1').loader(39, 12).m('target', 't1', 23, 10, 1, 2);
        d.move('crate1',41,13,44,13,3600).land(41,19,6,4).platform(45,16,2);
        d.belt('b2', 62, 11, 24, -1).sw('s2', 55, 14, 'b2').loader(84, 11).move('crate2',86,12,89,12,3900).land(86,19,6,4).platform(90,16,2);
        d.belt('b3',107,12,20).sw('s3',100,14,'b3').platform(128,13,4).jet('j1',118,12);
        // Optional maintenance catwalk rewards a longer jump; both routes rejoin on safe ground.
        d.platform(109,8,4).platform(116,7,4).platform(122,9,3).arc(112,7,5);
        d.cp(49).cp(95).foe('agitator', 73, 11).seal(1, 27, 9).seal(2, 76, 8).seal(3, 117, 5).item('helmet', 50).art('pipe', 18, 12, 23, 7).art('tank', 59, 11, 24, 10, 'LINHA 02').art('tank', 104, 12, 23, 10, 'CONTROLE');
        d.talk(10,'feka','Uma sentada no botão... e a esteira troca de lado!', undefined, 'dialogue').talk(52, 'joao', 'Para de encher o saco.', 'para_de_encher_o_saco');
        d.cue(15,14,'s1').cue(26, 12).cue(51, 14).cue(56,14,'s2').cue(64, 11).cue(81, 11).cue(97, 14).cue(111, 12).cue(139, 14);
    }
    if (w === 3 && n === 3) {
        d.land(0, 14, 18).land(18, 12, 12).land(35, 10, 12).land(51, 14, 17).land(68, 11, 12).land(85, 9, 13).land(104, 14, 16).land(120, 11, 14).land(140, 14, 20);
        d.jet('j1', 24, 12).jet('j2', 41, 10, 2100).platform(31, 11, 3).platform(48, 12, 3).platform(81, 10, 3).jet('j3', 74, 11, 900).jet('j4', 91, 9, 2600).platform(99, 11, 4).platform(135, 12, 4);
        d.platform(72, 7, 6).platform(87, 5, 8).move('sl', 100, 8, 112, 5).platform(116, 5, 16).secret(129, 5);
        d.cp(54).cp(107).seal(1, 39, 7).seal(2, 89, 3).seal(3, 124, 3).item('helmet', 55).art('tank', 18, 12, 12, 10, 'A').art('tank', 35, 10, 12, 9, 'B').art('tank', 68, 11, 12, 10, 'C').art('tank', 85, 9, 13, 8, 'D').art('pipe', 97, 14, 22, 8).talk(14, 'feka', 'Primeiro treme... depois espirra.', undefined, 'dialogue');
        d.cue(25, 12).cue(41, 10).cue(57, 14).cue(74, 11).cue(91, 9).cue(111, 14).cue(127, 11).cue(145, 14);
    }
    if (w === 3 && n === 4) {
        d.land(0, 14, 17).land(17, 12, 20).land(44, 10, 15).land(66, 14, 16).land(82, 11, 22).land(111, 9, 13).land(130, 14, 15).land(145, 11, 18).land(170, 14, 14);
        d.belt('b1', 17, 12, 20, -1).loader(35, 12).platform(38, 11, 5).jet('j1', 49, 10).jet('j2', 56, 10, 2100).platform(60, 12, 5).belt('b2', 82, 11, 22).jet('j3', 93, 11, 1500).platform(105, 10, 5).platform(125, 11, 4).loader(158, 11, true).platform(164, 12, 5);
        d.cp(69).cp(133).foe('agitator', 117, 9).seal(1, 27, 9).seal(2, 99, 8).seal(3, 154, 8).item('helmet', 70).arc(57, 8, 10).arc(121, 7, 10).art('tank', 17, 12, 20, 10, 'RECEPÇÃO').art('pipe', 44, 10, 15, 5).art('tank', 82, 11, 22, 10, 'PRESSÃO').art('tank', 145, 11, 18, 10, 'CALABREZZO');
        d.cue(27, 12).cue(51, 10).cue(74, 14).cue(98, 11).cue(117, 9).cue(137, 14).cue(154, 11).cue(177, 14);
    }
    if (w === 4 && n === 1) {
        d.land(0, 14, 18).land(35, 11, 14, 4).land(55, 9, 11, 4).land(73, 13, 13, 4).land(104, 10, 13, 4).land(123, 8, 12, 4).land(141, 14, 19);
        d.move('cab1', 17, 13, 32, 10).move('cab2', 86, 12, 101, 9).platform(50, 10, 4).platform(67, 11, 5).platform(118, 9, 4).platform(136, 10, 4);
        d.land(18, 21, 17, 2).platform(31, 17, 4).land(86, 21, 18, 2).platform(100, 17, 4).cp(37, 11).cp(106, 10).foe('rail', 60, 8, 28).foe('rail', 129, 7, 28).seal(1, 41, 9).seal(2, 93, 19).seal(3, 129, 5).item('helmet', 38, 10).art('station', 3, 14, 13, 7, 'ESTAÇÃO 01').art('pine', 35, 11, 10, 7).art('station', 104, 10, 13, 7, 'MIRANTE').art('pine', 124, 8, 9, 7).talk(13, 'feka', 'Próxima parada: Yasmin!');
        d.cue(41, 11).cue(60, 9).cue(79, 13).cue(110, 10).cue(129, 8).cue(148, 14);
    }
    if (w === 4 && n === 2) {
        d.land(0, 14, 24).land(34, 7, 16, 4).land(56, 12, 16, 4).land(83, 5, 17, 4).land(105, 12, 18).land(133, 7, 12, 4).land(149, 14, 11);
        d.lift('l1', 23, 13, 6).sw('s1', 19, 14, 'l1').platform(28, 7, 6).lift('l2', 71, 11, 4).sw('s2', 66, 12, 'l2').platform(77, 5, 6).lift('l3', 122, 11, 6).sw('s3', 117, 12, 'l3').platform(128, 7, 5);
        d.land(24, 21, 10, 2).platform(27, 17, 4).land(72, 21, 11, 2).platform(76, 16, 4).land(123, 21, 10, 2).platform(127, 16, 4).cp(58, 12).cp(108, 12).foe('rail', 42, 6, 25).foe('charger', 93, 5, 42).seal(1, 40, 4).seal(2, 88, 2).seal(3, 138, 4).item('helmet', 59, 11).art('station', 34, 7, 16, 6, 'PESO / CABO').art('pine', 57, 12, 10, 7).art('station', 83, 5, 17, 5, 'ALTO').art('pine', 134, 7, 10, 7);
        d.cue(20, 14, 's1').cue(25, 6).cue(41, 7).cue(62, 12).cue(67, 12, 's2').cue(73, 4).cue(91, 5).cue(112, 12).cue(118, 12, 's3').cue(124, 6).cue(139, 7).cue(153, 14);
    }
    if (w === 4 && n === 3) {
        d.land(0, 14, 17).land(36, 10, 12, 4).land(56, 7, 12, 4).land(76, 13, 13, 4).land(110, 9, 14, 4).land(142, 14, 18);
        d.move('cab1', 17, 13, 33, 9).platform(49, 9, 5).platform(69, 10, 5).move('cab2', 89, 12, 107, 8).move('sl', 123, 8, 135, 5).platform(134, 5, 10).secret(141, 5);
        d.platform(127, 11, 5).platform(136, 12, 5);
        d.land(17, 21, 19, 2).platform(32, 17, 4).land(89, 21, 21, 2).platform(106, 17, 4).cp(38, 10).cp(79, 13).foe('rail', 63, 6, 27).foe('rail', 117, 8, 28).seal(1, 41, 7).seal(2, 99, 19).seal(3, 138, 3).item('helmet', 80, 12).art('station', 1, 14, 14, 7, 'CABOS CRUZADOS').art('pine', 56, 7, 10, 6).art('station', 76, 13, 13, 7, 'SERVIÇO').art('station', 110, 9, 14, 7, 'CARGA').talk(105, 'biel', 'Essa cabine não é de passageiros.');
        d.cue(42, 10).cue(62, 7).cue(82, 13).cue(117, 9).cue(131, 11).cue(147, 14);
    }
    if (w === 4 && n === 4) {
        d.land(0, 14, 16).land(35, 10, 13, 4).land(55, 8, 13, 4).land(75, 13, 15).land(110, 9, 14, 4).land(130, 7, 12, 4).land(149, 11, 12, 4).land(168, 14, 16);
        d.move('p1', 16, 13, 32, 9).platform(49, 9, 5).platform(69, 10, 5).move('p2', 90, 12, 107, 8).platform(125, 8, 4).platform(143, 9, 5).platform(162, 12, 5);
        d.land(16, 21, 19, 2).platform(31, 17, 4).land(90, 21, 20, 2).platform(106, 17, 4).cp(38, 10).cp(78, 13).cp(152, 11).foe('rail', 61, 7, 25).foe('rail', 117, 8, 30).foe('charger', 136, 7, 32).seal(1, 41, 7).seal(2, 100, 19).seal(3, 136, 4).item('helmet', 79, 12).art('station', 1, 14, 14, 7, 'ÚLTIMA SUBIDA').art('pine', 55, 8, 12, 7).art('station', 75, 13, 15, 7, 'ENTRONCAMENTO').art('pine', 130, 7, 10, 6).art('station', 168, 14, 15, 8, 'BIEL');
        d.cue(41, 10).cue(61, 8).cue(82, 13).cue(117, 9).cue(136, 7).cue(154, 11).cue(176, 14);
    }
    if (w === 5 && n === 1) {
        d.land(0, 14, 19).land(19, 12, 16).land(41, 14, 16).land(57, 11, 18).land(82, 14, 16).land(98, 12, 18).land(123, 9, 14).land(143, 14, 17);
        d.platform(19, 12, 16, T.ICE).platform(57, 11, 18, T.ICE).platform(98, 12, 18, T.ICE).platform(123, 9, 14, T.ICE).platform(36, 13, 4).platform(76, 12, 5).platform(117, 11, 5).platform(138, 11, 4);
        d.cp(44).cp(85).foe('helmet', 68, 11, 45).foe('loader', 130, 9).seal(1, 26, 9).seal(2, 65, 8).seal(3, 130, 6).item('helmet', 45).arc(32, 10, 10).arc(112, 10, 11).art('freezer', 19, 12, 16, 10, 'ESTOQUE 01').art('freezer', 57, 11, 18, 10, '-18°').art('freezer', 98, 12, 18, 10, 'RESERVA').talk(13, 'feka', 'No gelo, soltar não basta. Preciso frear para o outro lado.', undefined, 'dialogue');
        d.cue(27, 12).cue(46, 14).cue(66, 11).cue(88, 14).cue(108, 12).cue(130, 9).cue(148, 14);
    }
    if (w === 5 && n === 2) {
        d.land(0, 14, 18).land(18, 12, 18).land(42, 10, 16).land(65, 14, 15).land(80, 11, 18).land(105, 9, 15).land(126, 14, 34);
        d.jet('j1', 26, 12).sw('s1', 15, 14, 'j1').platform(18, 12, 18, T.ICE).platform(37, 11, 4).jet('j2', 49, 10, 1800).platform(59, 12, 5).platform(80, 11, 18, T.ICE).jet('j3', 89, 11).platform(99, 10, 5).platform(121, 11, 4).loader(115, 9, true);
        d.cp(68).cp(129).foe('agitator', 111, 9).seal(1, 29, 9).seal(2, 48, 7).seal(3, 88, 8).item('helmet', 69).art('pipe', 18, 12, 18, 7).art('freezer', 42, 10, 16, 9, 'DEGELO').art('pipe', 80, 11, 18, 7).art('freezer', 105, 9, 15, 8, 'PRESSÃO').talk(11, 'feka', 'Uma válvula de cada vez.');
        d.cue(16, 14, 's1').cue(29, 12).cue(50, 10).cue(71, 14).cue(91, 11).cue(113, 9).cue(140, 14);
    }
    if (w === 5 && n === 3) {
        d.land(0, 14, 19).land(19, 12, 25).land(50, 14, 15).land(65, 11, 20).land(91, 14, 16).land(107, 12, 27).land(141, 14, 19);
        d.belt('b1', 19, 12, 25, -1).loader(42, 12, true).sw('s1', 15, 14, 'b1').m('target', 't1', 22, 9, 1, 3).platform(45, 13, 4).platform(65, 11, 20, T.ICE).jet('j1', 76, 11).platform(86, 12, 4).belt('sb', 107, 12, 27, -1).loader(132, 12, true).sw('ss', 103, 14, 'sb').m('target', 'st', 111, 9, 1, 3).platform(135, 13, 5);
        d.platform(116, 8, 6).platform(124, 5, 12).secret(133, 5, 'st').cp(53).cp(94).foe('agitator', 80, 11).seal(1, 30, 9).seal(2, 71, 8).seal(3, 127, 3).item('helmet', 54).art('freezer', 19, 12, 25, 10, 'RESERVA ESPECIAL').art('pipe', 65, 11, 20, 7).art('freezer', 107, 12, 27, 10, 'ACESSO RESTRITO').talk(9, 'calabrezzo', 'Isso é a reserva especial.');
        d.cue(30, 12).cue(56, 14).cue(71, 11).cue(98, 14).cue(119, 12).cue(148, 14);
    }
    if (w === 5 && n === 4) {
        d.land(0, 14, 17).land(17, 12, 18).land(42, 9, 14).land(63, 14, 16).land(79, 11, 23).land(109, 9, 13).land(128, 14, 15).land(143, 11, 20).land(170, 14, 14);
        d.platform(17, 12, 18, T.ICE).platform(36, 11, 5).jet('j1', 48, 9).platform(57, 11, 5).belt('b1', 79, 11, 23, -1).sw('s1', 75, 14, 'b1').loader(100, 11, true).platform(103, 10, 5).platform(109, 9, 13, T.ICE).platform(123, 11, 4).platform(143, 11, 20, T.ICE).jet('j2', 152, 11, 1900).platform(164, 12, 5);
        d.cp(66).cp(131).foe('agitator', 94, 11).seal(1, 48, 6).seal(2, 87, 8).seal(3, 155, 8).item('helmet', 67).arc(32, 10, 10).arc(119, 7, 10).art('freezer', 17, 12, 18, 10, 'FRIO').art('pipe', 42, 9, 14, 6).art('freezer', 79, 11, 23, 10, 'RESERVA').art('freezer', 143, 11, 20, 10, 'CALABREZZO');
        d.cue(26, 12).cue(49, 9).cue(70, 14).cue(88, 11).cue(116, 9).cue(135, 14).cue(154, 11).cue(177, 14);
    }
    if (w === 6 && n === 1) {
        d.land(0, 14, 18).land(18, 12, 14).land(38, 10, 14).land(59, 14, 16).land(75, 11, 14).land(95, 9, 15).land(116, 13, 14).land(136, 14, 24);
        d.platform(33, 11, 4).platform(53, 12, 5).m('support', 'sup1', 89, 9, 6, .5, { to: { x: 89 * 16, y: 12 * 16 } }).sw('s1', 84, 11, 'sup1').platform(111, 11, 4).platform(131, 13, 4).cp(62).cp(119, 13).foe('helmet', 26, 12, 35).foe('charger', 46, 10, 40).foe('minion', 103, 9, 40).seal(1, 25, 9).seal(2, 82, 8).seal(3, 103, 6).item('helmet', 63).art('arch', 18, 12, 14, 10, 'JARDINS').art('banner', 38, 10, 14, 7, 'JP').art('arch', 75, 11, 14, 10).art('banner', 95, 9, 15, 7, 'Y + J');
        d.cue(25, 12).cue(45, 10).cue(65, 14).cue(81, 11).cue(102, 9).cue(123, 13).cue(146, 14);
    }
    if (w === 6 && n === 2) {
        d.land(0, 14, 17).land(17, 12, 18).land(42, 10, 16).land(65, 14, 15).land(80, 11, 19).land(106, 9, 15).land(128, 14, 32);
        d.belt('b1', 17, 12, 18, -1).jet('j1', 28, 12).platform(36, 11, 5).jet('j2', 48, 10, 1700).platform(59, 12, 5).belt('b2', 80, 11, 19).jet('j3', 91, 11, 2100).platform(100, 10, 5).platform(122, 11, 5).cp(68).cp(131).foe('helmet', 113, 9, 40).foe('loader', 55, 10).seal(1, 24, 9).seal(2, 85, 8).seal(3, 113, 6).item('helmet', 69).art('oven', 17, 12, 18, 10, 'FORNO 01').art('oven', 42, 10, 16, 8, '02').art('oven', 80, 11, 19, 9, 'PIZZARINO').art('banner', 106, 9, 15, 7, 'JP');
        d.cue(24, 12).cue(49, 10).cue(71, 14).cue(87, 11).cue(113, 9).cue(141, 14);
    }
    if (w === 6 && n === 3) {
        d.land(0, 14, 23).land(34, 7, 18).land(58, 13, 17).land(75, 10, 16).land(98, 14, 15).land(123, 8, 18).land(146, 14, 14);
        d.lift('l1', 22, 13, 6).sw('s1', 18, 14, 'l1').platform(28, 7, 6).land(23, 20, 11, 3).platform(27, 17, 4).platform(53, 10, 4).platform(92, 12, 5).lift('sl', 112, 13, 7).sw('ss', 108, 14, 'sl').platform(118, 8, 5).land(113, 20, 10, 3).platform(117, 17, 4).platform(127, 4, 12).secret(136, 4, 'sl');
        d.cp(61, 13).cp(101).foe('helmet', 44, 7, 50).foe('charger', 83, 10, 45).seal(1, 42, 4).seal(2, 82, 7).seal(3, 131, 2).item('helmet', 62, 12).art('arch', 34, 7, 18, 6, 'PASSAGEM').art('banner', 75, 10, 16, 8, 'JP').art('arch', 123, 8, 18, 7, 'FUNDOS').talk(100, 'feka', 'Entrada de serviço também conta como entrada triunfal.');
        d.cue(19, 14, 's1').cue(24, 6).cue(43, 7).cue(65, 13).cue(83, 10).cue(105, 14).cue(109, 14, 'ss').cue(114, 7).cue(132, 8).cue(151, 14);
    }
    if (w === 6 && n === 4) {
        d.land(0, 14, 17).land(35, 10, 14).land(56, 8, 13).land(76, 14, 17).land(93, 11, 21).land(121, 9, 13).land(142, 13, 12).land(164, 10, 8).land(177, 14, 7);
        d.move('p1', 17, 13, 32, 9).platform(50, 9, 5).platform(70, 10, 5).belt('b1', 93, 11, 21, -1).jet('j1', 104, 11).platform(115, 10, 5).platform(135, 11, 6, T.PLATFORM_FALLING).platform(154, 13, 5, T.PLATFORM_FALLING).platform(160, 11, 4, T.PLATFORM_FALLING).platform(173, 12, 4);
        d.land(17, 21, 18, 2).platform(31, 17, 4).cp(38, 10).cp(79).cp(145, 13).foe('charger', 63, 8, 40).foe('helmet', 129, 9, 35).seal(1, 42, 7).seal(2, 99, 8).seal(3, 167, 7).item('helmet', 80).arc(66, 6, 11).arc(132, 7, 10).art('arch', 35, 10, 14, 9, 'ÚLTIMA TRAVESSIA').art('banner', 56, 8, 13, 7, 'JP').art('oven', 93, 11, 21, 10, 'FORNALHA').art('rope', 154, 13, 10, 7).art('arch', 164, 10, 8, 9).talk(139, 'joao', 'Você não vai ter!', 'voce_nao_vai_ter');
        d.cue(42, 10).cue(63, 8).cue(83, 14).cue(99, 11).cue(127, 9).cue(148, 13).cue(167, 10).cue(180, 14);
    }
    // The finish is always on a quiet, solid landing. Pickups guide jumps; they never mark empty death space.
    if(w===5) for(const m of d.s.mechanisms) if(m.kind==='target') m.pressurized=true;
    d.cue(d.s.level.width - 4, 14);
    for (const cue of d.s.route ?? [])
        if (!cue.switch)
            for (const dx of [-16, 16]) {
                const x = cue.x + dx, y = cue.y - 32;
                if (d.s.level.tiles[Math.floor(y / 16)]?.[Math.floor(x / 16)] === T.EMPTY && !d.s.pickups.some(p => Math.abs(p.x - x) < 22 && Math.abs(p.y - y) < 22))
                    d.s.pickups.push({ id: `${d.s.id}:c${d.s.pickups.length}`, kind: 'coin', x, y });
            }
    return d.done();
}
function arena(w: number): AdventureStage {
    const d = new Draft(w, 5, 20);
    d.s.encounter = ENCOUNTERS[w - 1];
    d.s.level.playerSpawn = { x: 2, y: 14 };
    d.s.checkpoints = [{ x: 2, y: 14 }];
    d.s.exits = [];
    d.item('helmet', 3, 13);
    const type = d.s.encounter;
    if (type === 'B1' || type === 'B2') {
        d.m('platform','dais',12.75,10.6875,2.625,.3125);
        d.lift('left', 5, 13, 10).lift('right', 15, 13, 10).sw('a', 3, 14, 'left').sw('b', 18, 14, 'right');
        if (type === 'B2')
            d.move('transfer', 7, 9, 15, 9, 4200);
    }
    if (type === 'C1' || type === 'C2') {
        d.m('platform','dais',16,12.5625,3.5625,.3125);
        d.belt('bossBelt', 7, 14, 11, -1).sw('a', 4, 14, 'bossBelt');
        d.m('lift','access',14,13,4,.5,{to:{x:224,y:160},gated:true}).jet('bossJet', 10, 14);
        if (type === 'C2')
            d.ice(8, 5).sw('b', 18, 14, 'bossBelt').m('target', 'iceLeft', 8, 11, 1, 3, {pressurized:true}).m('target', 'iceRight', 18, 11, 1, 3, {pressurized:true});
    }
    if (type === 'J2')
        d.m('platform','dais',16.5,11.8125,3.125,.3125).m('support', 'left', 5, 10, 4, .5, { to: { x: 80, y: 13 * 16 } }).m('support', 'right', 14, 10, 4, .5, { to: { x: 224, y: 13 * 16 } });
    const who = ISLANDS[w - 1].boss;
    d.talk(0, who, type === 'J1' ? 'Aqui é o João, namorado da Yasmin.' : type === 'J2' ? 'Eu sou o namorado dela.' : who === 'biel' ? 'A passagem fechou.' : 'Vamos fazer um controle de qualidade.', type === 'J1' ? 'aqui_e_o_joao_namorado_da_yasmin' : type === 'J2' ? 'eu_sou_o_namorado_dela' : undefined, 'dialogue');
    return d.done();
}
export const STAGES: AdventureStage[] = ISLANDS.flatMap(w => [1, 2, 3, 4].map(n => course(w.id, n)).concat(arena(w.id)));
export const stageById = (id: string) => STAGES.find(s => s.id === id);
