import { TileType as T } from '../../../constants';
import type { AdventureStage, FoeKind } from '../../types';
import type { WorldObjects } from '../../WorldPhysics';

export type GuairaCourseId = 'travessia' | 'patio' | 'respiros' | 'subida' | 'galeria' | 'alivio';
export interface GuairaCourse {
    start: number; end: number; finish: number; floor: number; finishY?:number;
    rooms: readonly { at: number; name: string; hint: string }[];
}
export interface GuairaCourseDetour {
    name: string; hint: string;
    /** Local world pixels, relative to the course's first district. */
    entry: number; end: number; entryY: number; top: number;
    decks: readonly (readonly [number,number,number,boolean?])[];
    returns: readonly (readonly [number,number,number])[];
    rewards: readonly (readonly [number,number])[];
    guard: {kind:FoeKind;x:number;y:number;range:number};
}

/** Optional loops develop the existing raised approaches. The lower route is
 * still valid; each loop rejoins before the following checkpoint. */
export const GUAIRA_COURSE_DETOURS: Readonly<Record<GuairaCourseId,GuairaCourseDetour>> = {
    travessia:{name:'VARANDA DO ARROZ',hint:'Desvio alto: atravesse a varanda e a couraça para recolher as moedas; desça à direita.',
        entry:144,end:592,entryY:144,top:64,decks:[[320,368,64],[416,480,64]],returns:[[512,560,128]],rewards:[[332,42],[428,42],[464,42]],guard:{kind:'helmet',x:444,y:64,range:12}},
    patio:{name:'PASSADICO DAS DOCAS',hint:'Desvio alto: suba pelos apoios das docas e salte sobre a patrulha; a descida reencontra a margem.',
        entry:176,end:624,entryY:144,top:48,decks:[[304,368,96],[400,512,48]],returns:[[528,560,112],[576,608,160]],rewards:[[320,74],[432,26],[496,26]],guard:{kind:'minion',x:480,y:48,range:8}},
    respiros:{name:'PONTE DO RESERVATORIO',hint:'Desvio alto: continue sobre a grelha e não pare nas tábuas rachadas; a varanda tem uma couraça.',
        entry:832,end:1312,entryY:208,top:144,decks:[[1040,1088,144,true],[1136,1200,144]],returns:[[1232,1280,224]],rewards:[[1056,122],[1152,122],[1184,122]],guard:{kind:'helmet',x:1160,y:144,range:12}},
    subida:{name:'BEIRAL DA PORTARIA',hint:'Desvio alto: use o beiral para passar sobre a investida; a primeira tábua cede e a sacada tem uma patrulha.',
        entry:1840,end:2112,entryY:80,top:48,decks:[[1920,1952,48,true],[2000,2064,48]],returns:[[2048,2096,96]],rewards:[[1932,26],[2012,26],[2036,26]],guard:{kind:'minion',x:2032,y:48,range:4}},
    galeria:{name:'VIGA DE INSPECAO',hint:'Desvio alto: atravesse a viga sobre o respiro, sem ficar na tábua rachada; retorne pela sacada.',
        entry:800,end:1296,entryY:96,top:48,decks:[[864,912,64],[976,1024,64,true],[1072,1136,48]],returns:[[1168,1200,112],[1232,1280,160]],rewards:[[884,42],[992,42],[1088,26],[1120,26]],guard:{kind:'minion',x:1100,y:48,range:12}},
    alivio:{name:'ALTO DO COLETOR',hint:'Desvio alto: continue pelo registro e pelo coletor; o apoio estreito liga a varanda à última sacada.',
        entry:224,end:688,entryY:240,top:144,decks:[[416,464,176],[480,512,176,true],[528,576,144]],returns:[[592,624,224],[640,672,288]],rewards:[[432,154],[492,154],[544,122],[568,122]],guard:{kind:'minion',x:548,y:144,range:8}},
};
/** Later maintenance loops trade the floor's water/combat for a different
 * encounter, then isolate one real outlet. Their first deck is always safe. */
export const GUAIRA_MAINTENANCE_ROUTES: Partial<Record<GuairaCourseId,GuairaCourseDetour & {outlet:string;valve:number}>> = {
    travessia:{name:'PASSADICO DA ECLUSA',hint:'Pelo alto, atravesse a tábua rachada e a patrulha. O registro depois da sacada fecha a descarga do canal; os apoios retornam à taipa.',
        entry:656,end:1184,entryY:144,top:48,
        decks:[[656,704,144],[752,816,96],[864,912,96,true],[960,1072,48]],returns:[[1088,1136,112]],
        rewards:[[676,122],[772,74],[884,74],[1040,26],[1108,90]],
        guard:{kind:'minion',x:1008,y:48,range:12},outlet:'lock-outlet',valve:1032},
    respiros:{name:'REGISTRO DAS TAIPAS',hint:'Suba pelos apoios firmes. Espere as pinças do mexedor recolherem antes de saltar sobre ele; o registro fecha a grelha da margem.',
        entry:1360,end:1936,entryY:256,top:160,
        decks:[[1360,1408,256],[1456,1504,192],[1568,1728,160]],returns:[[1760,1808,208],[1856,1904,256]],
        rewards:[[1380,234],[1476,170],[1588,138],[1696,138],[1872,234]],
        guard:{kind:'agitator',x:1624,y:160,range:0},outlet:'broken-bank',valve:1680},
    alivio:{name:'PASSADICO DO COLETOR',hint:'O teto do vagonete se abre quando ele freia nas pontas: aproveite para pisar no piloto. A sentada também quebra a proteção em movimento. O registro depois da passarela fecha a grelha do piso.',
        entry:1008,end:1616,entryY:288,top:208,
        decks:[[1008,1056,288],[1088,1136,240],[1184,1376,208]],returns:[[1392,1440,256],[1536,1584,288]],
        rewards:[[1028,266],[1108,218],[1204,186],[1352,186],[1552,266]],
        guard:{kind:'rail',x:1264,y:208,range:32},outlet:'collector-outlet',valve:1336},
};
export const guairaCourseDetours=(id:GuairaCourseId):readonly GuairaCourseDetour[]=>
    GUAIRA_MAINTENANCE_ROUTES[id]?[GUAIRA_COURSE_DETOURS[id],GUAIRA_MAINTENANCE_ROUTES[id]!]:[GUAIRA_COURSE_DETOURS[id]];
/** World pixels, not screen coordinates. The first rooms retain the hydraulic
 * lessons; these authored districts develop them into a complete journey. */
export const GUAIRA_COURSES: Readonly<Record<GuairaCourseId, GuairaCourse>> = {
    travessia: { start: 1536, end: 4352, finish: 4224, floor: 192, rooms: [
        { at: 0, name: 'TAIPAS VIVAS', hint: 'Caranguejos patrulham a margem. Salte sobre eles ou use a sentada.' },
        { at: 576, name: 'ECLUSA DO ARROZ', hint: 'A placa ergue a primeira ponte. Pare na ilha firme, observe a descarga e salte o segundo canal. O passadiço alto leva ao registro que fecha essa saída.' },
        { at: 1152, name: 'AGUA ENTRE TAIPAS', hint: 'Atravesse cada grelha no intervalo seco; a ilha entre elas permite parar.' },
        { at: 1792, name: 'TERREIRO DA COLHEITA', hint: 'O carregador guarda a entrada. Cruze os dois canais pela taipa central ou suba ao armazém: a couraça e a tábua rachada protegem as moedas.' },
    ] },
    patio: { start: 960, end: 3840, finish: 3776, floor: 208, rooms: [
        { at: 0, name: 'DOCAS DE SERVICO', hint: 'Salte entre as docas e observe o cascudo: a couraça exige dois golpes ou uma sentada.' },
        { at: 512, name: 'COMPORTA CENTRAL', hint: 'Abra a comporta, embarque e prepare o salto para a margem.' },
        { at: 1088, name: 'RETORNO DA AGUA', hint: 'O desvio alto fecha a grelha. Pelo piso, observe a pressão e o patrulheiro.' },
        { at: 1600, name: 'DOCA DO ARROZAL', hint: 'Combine o salto sobre a água com o intervalo do carregador.' },
        { at: 2016, name: 'CAIS DE TRANSBORDO', hint: 'Os elevadores alternam a altura. Embarque no primeiro, pare na ilha central e observe o segundo antes de saltar. Há margem firme antes da patrulha final.' },
    ] },
    respiros: { start: 1152, end: 4256, finish: 4192, floor: 304, rooms: [
        { at: 0, name: 'RITMO DAS GRELHAS', hint: 'Duas descargas independentes: observe cada manômetro a partir da margem seca.' },
        { at: 640, name: 'OFICINA SUSPENSA', hint: 'Suba para fechar o registro ou atravesse pelo chão no intervalo seco.' },
        { at: 1280, name: 'TAIPAS PARTIDAS', hint: 'Pelas margens, salte os canais e observe a descarga. Pelos andaimes, enfrente o mexedor e feche o registro da grelha.' },
        { at: 1856, name: 'CASA DO RESPIRO', hint: 'O tablado oferece altura contra os arremessos; a grelha continua no próprio ritmo.' },
        { at: 2336, name: 'BACIA DAS BOMBAS', hint: 'Espere o transporte na doca alta ou salte pela passarela rachada. Observe a margem de chegada antes de desembarcar.' },
    ] },
    subida: { start: 1344, end: 4544, finish: 4448, floor: 144, finishY:48, rooms: [
        { at: 0, name: 'TELHADOS DA VAZAO', hint: 'Leia a patrulha e salte entre telhados. As moedas indicam apoios altos.' },
        { at: 576, name: 'GUINCHO DA OFICINA', hint: 'A placa traz o tabuleiro. Espere na margem e salte para a sacada.' },
        { at: 1152, name: 'ANDAIMES VIVOS', hint: 'As tábuas rachadas cedem depois do contato: continue até o apoio firme.' },
        { at: 1728, name: 'PORTARIA DA VAZAO', hint: 'O investidor anuncia a corrida. Salte, deixe-o passar e ataque na recuperação.' },
        { at: 2272, name: 'ESCADARIA DO AQUEDUTO', hint: 'Ganhe altura pelas duas muralhas. A couraça guarda o primeiro patamar; a tábua entre eles cede. Observe o carregador antes de chegar ao aqueduto.' },
    ] },
    galeria: { start: 704, end: 3520, finish: 3440, floor: 192, rooms: [
        { at: 0, name: 'POCO DE MANUTENCAO', hint: 'Abra a tampa rachada; o túnel passa sob a parede e retorna à direita.' },
        { at: 576, name: 'OFICINA OCUPADA', hint: 'O carregador guarda o piso. O andaime oferece outra aproximação.' },
        { at: 1152, name: 'TABUAS DA GALERIA', hint: 'Salte sem ficar nas tábuas rachadas; há chão firme antes da última patrulha.' },
        { at: 1696, name: 'DESVIO DE INSPECAO', hint: 'A grelha protege o corredor. Atravesse no intervalo seco ou abra a tampa e explore o túnel: o registro de baixo desliga essa saída. Os degraus retornam ao corredor.' },
    ] },
    alivio: { start: 736, end: 3072, finish: 3008, floor: 336, rooms: [
        { at: 0, name: 'RAMAL DE PRESSAO', hint: 'O novo ramal tem registro próprio: subir e fazer manutenção abre uma travessia segura.' },
        { at: 576, name: 'OFICINA DO RETORNO', hint: 'O cascudo ocupa a margem. Use a altura e cuide da água entre os apoios.' },
        { at: 1088, name: 'DESCARGA DO COLETOR', hint: 'O carregador e a grelha guardam o piso. A passarela do vagonete leva ao registro que isola essa descarga.' },
        { at: 1568, name: 'CONTRAPRESSAO', hint: 'As grelhas descarregam alternadamente. Use o apoio entre elas ou suba à válvula protegida para fechar a segunda saída.' },
    ] },
};

/** Every obstacle is a native tile, enemy or mechanism. No second collision,
 * movement, damage or completion system is introduced for this chapter. */
export function developGuairaCourse(stage: AdventureStage, id: GuairaCourseId): AdventureStage {
    const g = GUAIRA_COURSES[id], x0 = g.start, f = g.floor;
    stage.level.width = g.end / 16;
    for (const row of stage.level.tiles) {
        row.length = stage.level.width;
        for (let x = x0 / 16; x < stage.level.width; x++) row[x] = T.EMPTY;
    }
    const fill = (left: number, right: number, top: number, bottom: number, tile: T) => {
        for (let y = top / 16; y < Math.min(stage.level.height, bottom / 16); y++)
            for (let x = (x0 + left) / 16; x < (x0 + right) / 16; x++) stage.level.tiles[y][x] = tile;
    };
    const ground = (left: number, right: number, top = f) => fill(left, right, top, stage.level.height * 16, T.GROUND);
    const gap = (left: number, right: number) => fill(left, right, 0, stage.level.height * 16, T.EMPTY);
    const deck = (left: number, right: number, y: number, falling = false) => fill(left, right, y, y + 16, falling ? T.PLATFORM_FALLING : T.PLATFORM);
    const foe = (kind: FoeKind, x: number, y = f, range = 40) => stage.foes.push({ id: `${stage.id}:course:${kind}:${x}`, kind, x: x0 + x, y, range,
        ...(kind === 'loader' || kind === 'charger' ? { guardFacing: -1 as const } : {}) });
    const coins = (points: number[][]) => points.forEach(([x,y], i) => stage.pickups.push({ id: `${stage.id}:course:coin:${x}:${i}`, kind: 'coin', x: x0+x, y }));
    const helmet = (x: number, y: number) => stage.pickups.push({ id: `${stage.id}:course:helmet:${x}`, kind: 'helmet', x:x0+x, y });
    const cp = (x: number, y = f) => stage.checkpoints.push({ x:(x0+x)/16, y:y/16 });
    const jet = (name: string, x: number, width: number, phase: number, top = f-128) => {
        const key = `${stage.id}:course:${name}`;
        stage.mechanisms.push({id:key,kind:'jet',x:x0+x,y:top,width,height:f-top+4,period:4200,phase});
        return key;
    };
    const valve = (x: number, y: number, link: string) => stage.mechanisms.push({id:`${link}:valve`,kind:'switch',x:x0+x,y:y-8,width:32,height:8,link});
    const bridge = (left: number, right: number, plate: number) => {
        gap(left,right);
        const key=`${stage.id}:course:bridge:${left}`;
        stage.mechanisms.push({id:key,kind:'lift',x:x0+left,y:f+112,width:right-left,height:8,to:{x:x0+left,y:f},gated:true});
        valve(plate,f,key);
    };
    ground(0,g.end-x0); cp(32);
    if (id === 'travessia') {
        foe('minion',192,f,40); gap(320,400); foe('helmet',496,f,28);
        deck(144,192,f-48); deck(240,288,f-96); coins([[156,f-70],[252,f-118],[280,f-118]]); helmet(264,f-118);
        // A raised bridge reaches a permanent refuge, not the far bank. The
        // second channel asks for a timed jump. The maintenance walk trades
        // that timing for a fragile span, a guard and a working return valve.
        cp(608); gap(784,1056); ground(880,960); bridge(784,880,704);
        jet('lock-outlet',928,32,1200,f-80);
        coins([[824,f-22],[900,f-22],[1076,f-22]]);
        cp(1184); jet('taipa-a',1344,80,0); jet('taipa-b',1552,96,1900);
        deck(1440,1504,f-48); coins([[1460,f-70],[1490,f-70]]);
        foe('helmet',1704,f,20); cp(1824);
        foe('loader',2048,f); deck(1936,2000,f-48); deck(2080,2128,f-48);
        // A lower sequence asks for two deliberate jumps and a reset on the
        // rice bank. The warehouse route trades that reset for armour and a
        // fragile span; neither route removes the other from the level.
        gap(2160,2240); gap(2304,2400);
        deck(2064,2128,f-96); foe('helmet',2096,f-96,10);
        deck(2208,2256,f-96,true); deck(2336,2432,f-96); deck(2432,2480,f-64); deck(2480,2528,f-32);
        coins([[2184,f-40],[2264,f-22],[2336,f-40],
            [2080,f-118],[2112,f-118],[2224,f-118],[2352,f-118],[2384,f-118],[2448,f-86]]);
        foe('minion',2640,f,12);
    } else if (id === 'patio') {
        foe('minion',160,f,32); gap(256,336); foe('helmet',432,f,32);
        deck(176,224,f-64); coins([[188,f-86],[212,f-86]]);
        cp(640); bridge(752,944,672); foe('minion',1008,f,24);
        cp(1120); const outlet=jet('return-grate',1360,96,1100);
        deck(1184,1232,f-48); deck(1264,1312,f-96); valve(1264,f-96,outlet);
        coins([[1196,f-70],[1272,f-126],[1410,f-118]]); deck(1360,1440,f-96);
        foe('helmet',1512,f,24); cp(1632); gap(1728,1824);
        foe('loader',1904,f); deck(1664,1712,f-48); deck(1840,1888,f-48); helmet(1680,f-70);
        cp(2048); deck(2080,2128,f-48); gap(2176,2560); ground(2336,2384,f-48);
        deck(2528,2560,f-48); deck(2560,2592,f-32); deck(2592,2624,f-16);
        // Complementary native hoists. A permanent island splits a moving
        // crossing into two decisions and offers a place to observe the cycle.
        for(const [name,x,phase]of [['a',2160,0],['b',2432,3400]] as const)
            stage.mechanisms.push({id:`${stage.id}:course:transfer-${name}`,kind:'platform',x:x0+x,y:f+48,width:96,height:8,
                to:{x:x0+x,y:f-48},period:6800,phase,
                motion:{kind:'shuttle',maxSpeed:48,rampMs:450,dwellMs:700},
                mounts:[{kind:'ground',x:x0+(name==='a'?2168:2376),y:name==='a'?f:f-48},
                    {kind:'ground',x:x0+(name==='a'?2344:2576),y:name==='a'?f-48:f}]});
        foe('helmet',2720,f,12);
        coins([[2096,f-70],[2216,f-70],[2352,f-70],[2464,f-70],[2600,f-38]]);
    } else if (id === 'respiros') {
        jet('rhythm-a',176,80,0); jet('rhythm-b',384,96,2100); foe('minion',560,f,24);
        deck(288,336,f-48); coins([[300,f-70],[324,f-70]]);
        cp(672); const outlet=jet('workshop-grate',944,112,900);
        deck(752,800,f-48); deck(832,880,f-96); valve(832,f-96,outlet);
        deck(928,992,f-144); deck(1056,1104,f-64); foe('helmet',1168,f,24);
        coins([[764,f-70],[844,f-126],[944,f-166],[1080,f-86]]); helmet(956,f-166);
        cp(1312); gap(1424,1504); foe('minion',1552,f,20); gap(1632,1728);
        jet('broken-bank',1792,64,700); cp(1888);
        foe('loader',2088,f); deck(1984,2032,f-64); deck(2112,2176,f-64);
        jet('last-breath',2224,80,2300); coins([[1996,f-86],[2144,f-86],[2256,f-120]]);
        // Two genuinely different crossings share one visible receiving bank:
        // ride the upper cargo cradle, or commit to the fragile service walk.
        cp(2368); deck(2480,2544,f-48); gap(2592,2848);
        deck(2592,2656,f,true); deck(2704,2752,f,true); deck(2800,2848,f,true);
        stage.mechanisms.push({id:`${stage.id}:course:pump-carriage`,kind:'platform',x:x0+2528,y:f-48,width:64,height:8,
            to:{x:x0+2800,y:f-48},period:9600,motion:{kind:'shuttle',maxSpeed:80,rampMs:400,dwellMs:750},
            mounts:[{kind:'ground',x:x0+2536,y:f},{kind:'ground',x:x0+2872,y:f}]});
        deck(2848,2896,f-48); foe('helmet',2952,f,12);
        coins([[2616,f-24],[2720,f-24],[2824,f-24],[2704,f-70],[2736,f-70],[2768,f-70],[3024,f-22]]);
    } else if (id === 'subida') {
        foe('helmet',176,f,40); gap(288,384); deck(224,272,f-48);
        foe('minion',480,f,32); coins([[236,f-70],[316,f-62],[352,f-62]]);
        cp(608); bridge(800,992,672); deck(736,784,f-64); coins([[748,f-86]]); helmet(760,f-86);
        stage.mechanisms.find(b=>b.id===`${stage.id}:course:bridge:800`)!.to!.y=f-48;
        ground(992,1120,f-48); deck(800,848,f+64);
        foe('loader',1088,f-48); cp(1184);
        gap(1344,1568); deck(1344,1408,f,true); deck(1456,1504,f-16,true); deck(1536,1568,f,true);
        coins([[1360,f-36],[1472,f-52],[1548,f-36]]);
        foe('helmet',1648,f,24); cp(1760);
        foe('charger',1968,f,48); deck(1840,1888,f-64); deck(2048,2096,f-48);
        gap(2128,2224); coins([[1852,f-86],[2072,f-70],[2168,f-62]]);
        // The destination is physically higher. Wide masonry landings separate
        // two fights; the narrow fragile span asks for a committed second climb.
        cp(2304); deck(2384,2432,f-32); ground(2448,2608,f-48);
        foe('helmet',2528,f-48,16); gap(2608,2736); deck(2640,2688,f-80,true);
        ground(2736,g.end-x0,f-96); foe('loader',2880,f-96);
        coins([[2400,f-54],[2544,f-70],[2656,f-102],[2760,f-118],[2912,f-118],[3024,f-118]]);
    } else if (id === 'galeria') {
        // A real maintenance underpass: break the roof, descend below the
        // retaining wall, then climb back by three fixed, visible steps.
        fill(224,448,f,f+96,T.EMPTY); ground(224,448,f+96);
        fill(224,288,f,f+16,T.BRICK_BREAKABLE); fill(288,304,0,f+48,T.GROUND);
        ground(336,368,f+64); ground(384,416,f+32);
        foe('minion',480,f,16); coins([[240,f+60],[318,f+70],[396,f+10]]);
        cp(608); foe('loader',800,f); deck(704,752,f-48); deck(800,848,f-96);
        coins([[716,f-70],[812,f-118],[836,f-118]]); helmet(824,f-118);
        jet('workshop-outlet',944,80,1300); foe('helmet',1088,f,24); cp(1280);
        gap(1312,1504); deck(1312,1376,f,true); deck(1424,1472,f-16,true); deck(1488,1504,f,true);
        coins([[1328,f-36],[1440,f-52]]); foe('minion',1584,f,24);
        cp(1728);
        // The maintenance loop is an actual room under the hazardous corridor,
        // with its own defender, working valve, and a visible stairway back out.
        fill(1888,2368,f,f+96,T.EMPTY); ground(1888,2368,f+96);
        fill(1888,1952,f,f+16,T.BRICK_BREAKABLE);
        fill(1968,2256,f,f+16,T.GROUND); fill(1984,2000,f+16,f+48,T.GROUND);
        ground(2256,2304,f+64); ground(2304,2352,f+32);
        const bypass=jet('inspection-outlet',2080,80,700);
        foe('helmet',2112,f+96,16); valve(2192,f+96,bypass);
        // Approach the last thrower on one plane: its whole silhouette and the
        // landing stay visible even at the apex of a held native jump.
        foe('loader',2560,f);
        coins([[1920,f+74],[2032,f+74],[2144,f+74],[2216,f+74],[2272,f+42],
            [2016,f-22],[2208,f-22],[2464,f-22],[2688,f-22]]);
    } else {
        const outlet=jet('independent-ramal',320,112,800);
        deck(144,192,f-48); deck(224,272,f-96); valve(224,f-96,outlet);
        deck(320,384,f-112); coins([[156,f-70],[236,f-126],[344,f-134]]); helmet(356,f-134);
        foe('minion',496,f,24); cp(704); foe('helmet',768,f,32); gap(880,976);
        deck(816,864,f-48); coins([[828,f-70],[916,f-62],[948,f-62]]);
        cp(1120); foe('loader',1328,f); deck(1184,1232,f-64); deck(1328,1376,f-64);
        jet('collector-outlet',1440,80,2100); coins([[1196,f-86],[1352,f-86],[1472,f-120]]);
        // The central refuge separates two readings. The guarded maintenance
        // route costs a climb and a fight, then removes the second discharge.
        cp(1600); jet('counterpressure-a',1760,64,0);
        const returnOutlet=jet('counterpressure-b',1968,64,2100);
        deck(1696,1744,f-64); deck(1808,1856,f-128); deck(1888,1952,f-128); deck(1872,1920,f-48);
        foe('helmet',1904,f-128,10); valve(1920,f-128,returnOutlet);
        foe('loader',2176,f); deck(2080,2128,f-48);
        coins([[1712,f-86],[1824,f-150],[1896,f-150],[1936,f-150],[1888,f-70],[2096,f-70],[2256,f-22]]);
    }
    const detour=GUAIRA_COURSE_DETOURS[id];
    for(const [left,right,y,falling]of detour.decks)deck(left,right,y,falling);
    for(const [left,right,y]of detour.returns)deck(left,right,y);
    for(const [i,[x,y]]of detour.rewards.entries())stage.pickups.push({id:`${stage.id}:course:detour:coin:${i}`,kind:'coin',x:x0+x,y});
    const guard=detour.guard;
    stage.foes.push({id:`${stage.id}:course:detour:guard`,kind:guard.kind,x:x0+guard.x,y:guard.y,range:guard.range});
    const maintenance=GUAIRA_MAINTENANCE_ROUTES[id];
    if(maintenance){
        for(const [left,right,y,falling]of maintenance.decks)deck(left,right,y,falling);
        for(const [left,right,y]of maintenance.returns)deck(left,right,y);
        for(const [i,[x,y]]of maintenance.rewards.entries())stage.pickups.push({id:`${stage.id}:course:maintenance:coin:${i}`,kind:'coin',x:x0+x,y});
        const guard=maintenance.guard;
        stage.foes.push({id:`${stage.id}:course:maintenance:guard`,kind:guard.kind,x:x0+guard.x,y:guard.y,range:guard.range});
        valve(maintenance.valve,maintenance.top,`${stage.id}:course:${maintenance.outlet}`);
    }
    for (const enemy of stage.foes) enemy.behavior = 'canal';
    stage.level.goalPosition={x:g.finish/16,y:(g.finishY??f)/16};
    // Stage factories already refer to the new finish. Keep that final cue
    // after the districts instead of sending route consumers there and back.
    stage.route=[...(stage.route??[]).filter(point=>point.x<x0),
        ...g.rooms.map(room=>({x:x0+room.at+32,y:f})),{x:g.finish,y:g.finishY??f}];
    return stage;
}

export function guairaCourseRoom(id: GuairaCourseId, x: number) {
    const g=GUAIRA_COURSES[id];
    return [...g.rooms].reverse().find(room=>x>=g.start+room.at);
}

/** A checkpoint beyond a bridge grants a return passage, including visits that
 * used an upper bypass. Rebuild the raised pose for exploration after retry. */
export function restoreGuairaCoursePassages(objects:WorldObjects,checkpointX:number){
    for(const b of objects.bodies){
        if(!b.id.includes(':course:bridge:')||b.kind!=='lift'||!b.to||checkpointX<=b.x+b.width)continue;
        b.active=b.observedActive=true;b.x=b.px=b.to.x;b.y=b.py=b.to.y;
        const plate=objects.bodies.find(p=>p.kind==='switch'&&p.link===b.id);
        if(plate)plate.active=plate.observedActive=true;
    }
}
