import type { WorldGame } from '../../WorldGame';
import { TileType as T } from '../../../constants';
import { jetCycle } from '../../WorldMachineState';
import { GUAIRA_COURSES, guairaCourseDetours, GUAIRA_MAINTENANCE_ROUTES, guairaCourseRoom, type GuairaCourseId, type GuairaCourseDetour } from './GuairaCourseDesign';
import { guairaLinkedControl } from './GuairaControlArt';

interface CourseNavigation {
    objects:WorldGame['objects']; id:GuairaCourseId;
    direction:-1|1; extreme:number; detour:number|null; warehouse:boolean;
}
const navigation=new WeakMap<WorldGame,CourseNavigation>();
const currentNavigation=(game:WorldGame,id:GuairaCourseId)=>{
    const v=navigation.get(game);return v?.objects===game.objects&&v.id===id?v:undefined;
};

function onUpperSupport(game:WorldGame,id:GuairaCourseId,d:GuairaCourseDetour){
    const p=game.player.data,feet=p.position.y+p.height;
    if(!p.isGrounded||feet>d.entryY+4)return false;
    const local=p.position.x-GUAIRA_COURSES[id].start;
    // A lower combat scaffold can occupy the same x as a maintenance route.
    // Recognize its authored surfaces, not every platform below the entry.
    const surfaces=[...d.decks,...d.returns,[d.entry,d.entry+48,d.entryY] as const];
    if(d===GUAIRA_MAINTENANCE_ROUTES[id]&&!surfaces.some(([left,right,top])=>Math.abs(feet-top)<1&&local+p.width>left&&local<right))return false;
    const row=game.level.worldToRow(feet+.01);
    return [p.position.x+.01,p.position.x+p.width-.01].some(x=>{
        const tile=game.level.getTile(game.level.worldToCol(x),row);
        return tile===T.PLATFORM||tile===T.PLATFORM_FALLING;
    });
}

/** Called after native movement, never by the painter. Remember a chosen upper
 * route until its descent rejoins the floor; braking does not reverse guidance. */
export function updateGuairaCourseNavigation(game:WorldGame,id:GuairaCourseId,reset=false){
    const p=game.player.data,x=p.position.x,g=GUAIRA_COURSES[id];
    let v=currentNavigation(game,id);
    if(!v||reset){v={objects:game.objects,id,direction:1,extreme:x,detour:null,warehouse:false};navigation.set(game,v);}
    if(v.direction===1){v.extreme=Math.max(v.extreme,x);if(x<v.extreme-28){v.direction=-1;v.extreme=x;}}
    else {v.extreme=Math.min(v.extreme,x);if(x>v.extreme+28){v.direction=1;v.extreme=x;}}
    const local=x-g.start,feet=p.position.y+p.height;
    const d=guairaCourseDetours(id).find(d=>local>=d.entry-24&&local<=d.end);
    if(!d||feet>=g.floor-1)v.detour=null;
    else if(onUpperSupport(game,id,d))v.detour=d.entry;
    if(id!=='travessia'||local<2048||local>2544||feet>=g.floor-1)v.warehouse=false;
    else if(p.isGrounded&&feet===g.floor-96)v.warehouse=true;
    return v;
}

export const guairaWarehouseRoute=(game:WorldGame)=>!!currentNavigation(game,'travessia')?.warehouse;

export function guairaDetourAt(game:WorldGame,id:GuairaCourseId) {
    const p=game.player.data,local=p.position.x-GUAIRA_COURSES[id].start;
    const d=guairaCourseDetours(id).find(d=>local>=d.entry-24&&local<=d.end);
    return d&&p.position.y+p.height<GUAIRA_COURSES[id].floor-1
        &&(currentNavigation(game,id)?.detour===d.entry||onUpperSupport(game,id,d))?d:null;
}

export function guairaDetourRecovery(game:WorldGame,id:GuairaCourseId){
    const d=guairaDetourAt(game,id),p=game.player.data;
    return !!d&&p.position.y+p.height>d.entryY+4&&p.position.x-GUAIRA_COURSES[id].start<d.decks.at(-1)![0];
}

const outlets: Readonly<Record<string, { hint: string; effect: string; onward: string }>> = {
    'lock-outlet': { hint:'DESCARGA DO CANAL FECHADA', effect:'a descarga do canal abaixo e à esquerda', onward:'Desça pelos apoios à direita. A água do canal ainda exige o salto entre as margens.' },
    'return-grate': { hint:'GRELHA DO RETORNO FECHADA', effect:'a grelha do retorno, no piso à direita', onward:'Você pode seguir pelos apoios ou descer para o piso; a patrulha continua ali.' },
    'workshop-grate': { hint:'GRELHA DA OFICINA FECHADA', effect:'a grelha da oficina, abaixo e à direita', onward:'O passadiço alto continua pelas tábuas rachadas. Pelo piso, observe a patrulha.' },
    'broken-bank': { hint:'GRELHA DA MARGEM FECHADA', effect:'a grelha da margem, abaixo e à direita', onward:'Desça pelos apoios à direita; os canais entre as taipas continuam abertos.' },
    'inspection-outlet': { hint:'GRELHA DO ALTO FECHADA', effect:'a grelha do corredor acima e à esquerda', onward:'Para sair do túnel, suba os degraus à direita.' },
    'independent-ramal': { hint:'SAIDA DO RAMAL FECHADA', effect:'a saída deste ramal, abaixo e à direita', onward:'Siga pela varanda ou retorne ao piso. Este registro não altera as outras saídas.' },
    'counterpressure-b': { hint:'SEGUNDA GRELHA FECHADA', effect:'somente a segunda grelha, abaixo e à direita', onward:'A primeira continua descarregando. Desça pelos apoios à direita e observe o próximo carregador.' },
    'collector-outlet': { hint:'SAIDA DO COLETOR FECHADA', effect:'a saída do coletor, abaixo e à direita', onward:'Desça pelos apoios à direita para reencontrar o piso.' },
};

/** Describe the actual receiving mechanism close to its control. A short
 * native-clock grace keeps feedback visible during the pound's rebound; it
 * cannot leak through another floor or follow the player into the next room. */
function controlGuidance(game:WorldGame,id:GuairaCourseId){
    const p=game.player.data,x=p.position.x+p.width/2,feet=p.position.y+p.height,time=game.objects.time;
    const controls=game.objects.bodies.filter(b=>b.kind==='switch'&&b.id.includes(':course:')).map(b=>{
        const target=game.objects.get(b.link??''),age=b.changedAt===undefined?Infinity:time-b.changedAt;
        const recent=age>=0&&age<1800,dx=Math.abs(b.x+b.width/2-x),dy=feet-b.y-b.height;
        const close=dx<=(target?.active?64:96)&&Math.abs(dy)<24;
        const bridgeApproach=target?.kind==='lift'&&b.changedAt!==undefined&&x>=b.x-16&&x<=target.x+32
            &&feet>=Math.min(b.y+b.height,target.to?.y??b.y)-16&&feet<=b.y+b.height+24;
        return {b,target,recent,distance:dx,visible:close||bridgeApproach||recent&&dx<=120&&dy>=-88&&dy<24};
    }).filter(v=>v.target&&v.visible).sort((a,b)=>a.distance-b.distance);
    const nearest=controls[0];if(!nearest)return null;
    const {b,target:body,recent}=nearest,target=body!,state=guairaLinkedControl(b,target);
    if(target.kind==='lift'){
        if(state.phase==='moving')return {hint:target.active?'PONTE SUBINDO: ESPERE':'PONTE DESCENDO: ESPERE',
            detail:'O tabuleiro ainda está se movendo. Espere no apoio firme e observe sua chegada antes de avançar.'};
        if(state.phase==='settled')return {hint:'PONTE PRONTA A DIREITA',detail:id==='travessia'
            ?'A ponte chegou à margem. Siga até a ilha firme; a descarga e o salto do segundo canal continuam ativos.'
            :id==='subida'?'O tabuleiro chegou à altura da sacada. Salte da margem para a ponte e siga à direita.'
            :'A ponte chegou à margem. Atravesse o tabuleiro e prepare o salto para a próxima doca.'};
        return {hint:'PULE + BAIXO NO REGISTRO',detail:'A sentada neste pedal ergue a ponte à direita. Espere no apoio firme até o tabuleiro chegar.'};
    }
    if(target.kind!=='jet')return null;
    const outlet=outlets[target.id.split(':course:')[1]];if(!outlet)return null;
    if(target.active)return {hint:outlet.hint,detail:`Você fechou ${outlet.effect}. ${outlet.onward} Outra sentada no mesmo pedal reabre essa saída.`};
    if(recent)return {hint:'SAIDA REABERTA: CUIDADO',detail:`O registro reabriu ${outlet.effect}. Observe o manômetro: a pressão volta após o aviso. ${outlet.onward}`};
    return {hint:'PULE + BAIXO NO REGISTRO',detail:`A sentada neste pedal fecha ${outlet.effect}. ${outlet.onward}`};
}

/** Warnings describe the threat on the player's actual level. A distant grate
 * must not suppress an approaching throw, and a jet below a beam is not on it. */
export function guairaCourseGuidance(game:WorldGame,id:GuairaCourseId) {
    const p=game.player.data,x=p.position.x,feet=p.position.y+p.height;
    const room=guairaCourseRoom(id,x);if(!room)return null;
    const detour=guairaDetourAt(game,id);
    const backtracking=currentNavigation(game,id)?.direction===-1;
    const recovering=guairaDetourRecovery(game,id);
    const descending=detour&&!backtracking&&x+p.width/2>=GUAIRA_COURSES[id].start+detour.decks.at(-1)![1]-16;
    const fragile=p.isGrounded&&game.level.getFallingPlatformRenderData().some(b=>b.phase!=='falling'
        &&Math.abs(game.level.rowToWorldY(b.row)-feet)<1&&game.level.colToWorldX(b.col)<x+p.width&&game.level.colToWorldX(b.col)+16>x);
    const nearby=(left:number,width:number)=>left+width>=x-(backtracking?180:48)&&left<=x+(backtracking?48:180);
    const foes=game.foes.filter(e=>{
        if(e.dead||!nearby(e.x,e.width))return false;
        const height=e.y+e.height-feet;
        // A bounce or the porter's ledge puts the player above the exposed
        // target. Keep that visible opening in view of the guidance instead
        // of switching to an unrelated guard on the next balcony.
        const opening=e.spec.kind==='helmet'&&e.phase==='stunned'
            ||e.spec.kind==='charger'&&e.phase==='rest'||e.spec.kind==='rail'&&e.phase==='warning';
        return Math.abs(height)<64||opening&&height>=0&&height<=112&&Math.abs(e.x-x)<96
            &&e.y>=game.camera.y+23&&e.y+e.height<=game.camera.y+180;
    })
        .sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x));
    const jet=game.objects.bodies.filter(b=>b.kind==='jet'&&nearby(b.x,b.width)&&feet>b.y&&p.position.y<b.y+b.height)
        .sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x))[0];
    const cycle=jet?jetCycle(jet,game.objects.time):null;
    const immediate=jet&&jet.x<x+p.width+(backtracking?8:32)&&jet.x+jet.width>x-(backtracking?32:8);
    const warning=foes.find(e=>e.phase==='warning'||['charger','agitator','minion'].includes(e.spec.kind)&&e.phase==='attack');
    const foe=foes[0],control=controlGuidance(game,id);
    const barrel=game.objects.barrels.find(b=>b.life>0&&Math.abs(b.x-x)<96&&b.y+16>p.position.y&&b.y<feet);
    const local=x-GUAIRA_COURSES[id].start;
    const carriage=id==='respiros'?game.objects.bodies.find(b=>b.id.endsWith(':pump-carriage')):undefined;
    const riding=carriage&&p.isGrounded&&Math.abs(feet-carriage.y)<1&&x+p.width>carriage.x&&x<carriage.x+carriage.width;
    const boarding=carriage&&local>=2464&&local<2592&&feet<=GUAIRA_COURSES[id].floor-32;
    const counterpressure=id==='alivio'&&local>=1648&&local<2080;
    const closedReturn=counterpressure&&game.objects.bodies.find(b=>b.id.endsWith(':counterpressure-b'))?.active;
    const transfer=id==='patio'&&local>=2080&&local<2624;
    const aboard=transfer&&game.objects.bodies.find(b=>b.id.includes(':transfer-')&&p.isGrounded&&Math.abs(feet-b.y)<1&&x+p.width>b.x&&x<b.x+b.width);
    const refuge=transfer&&local>=2322&&local<2384&&p.isGrounded&&feet===GUAIRA_COURSES[id].floor-48;
    const warehouse=id==='travessia'&&guairaWarehouseRoute(game);
    const inspection=id==='galeria'&&local>=1824&&local<2416;
    const isolated=inspection&&game.objects.bodies.find(b=>b.id.endsWith(':inspection-outlet'))?.active;
    const maintenance=GUAIRA_MAINTENANCE_ROUTES[id];
    const maintaining=maintenance&&detour===maintenance;
    const maintained=maintaining&&game.objects.bodies.find(b=>b.id.endsWith(':course:'+maintenance.outlet))?.active;
    const sluice=id==='travessia'&&local>=640&&local<1184&&!detour;
    const lock=sluice?game.objects.bodies.find(b=>b.id.endsWith(':course:bridge:784')):undefined;
    const island=sluice&&local>=872&&local<928&&p.isGrounded&&feet===192;
    const hint=immediate&&cycle?.danger?'AGUA NA GRELHA':warning?.spec.kind==='charger'?'INVESTIDA: PREPARE O SALTO'
        :warning?.spec.kind==='agitator'?(warning.phase==='attack'?'PINCAS ABERTAS: ESPERE':'MEXEDOR: RECUE ANTES DO GIRO')
        :warning?.spec.kind==='rail'?'VAGONETE FREOU: ATAQUE'
        :warning?.spec.kind==='minion'?(warning.phase==='attack'?'PINCA ABERTA: SALTE':'PINCA: PREPARE O SALTO')
        :warning?.spec.kind==='loader'&&warning.highThrow?'ARREMESSO ALTO A CAMINHO'
        :warning?'ARREMESSO A CAMINHO':barrel?'BARRIL: SALTE OU RECUE':immediate&&cycle?.phase==='charging'?'PRESSAO SUBINDO'
        :fragile?'TABUA CEDE - CONTINUE':control?control.hint:foe?.spec.kind==='helmet'&&foe.armor?'SENTADA QUEBRA A COURACA'
        :foe?.spec.kind==='helmet'&&foe.phase==='stunned'?'COURACA QUEBRADA: ATAQUE'
        :foe?.spec.kind==='charger'&&foe.phase==='rest'?'AGORA: ATAQUE POR CIMA'
        :foe?.spec.kind==='agitator'&&foe.phase==='rest'?'PINCAS RECOLHIDAS: SALTE'
        :foe?.spec.kind==='rail'?'VAGONETE: SENTADA OU ESPERE'
        :aboard?(aboard.id.endsWith('-a')?'ELEVADOR 1: ILHA A DIREITA':'ELEVADOR 2: MARGEM A DIREITA')
        :refuge?'ILHA FIRME: OBSERVE O ELEVADOR'
        :transfer?(local>=2496?'DOCA: DESCA PELOS DEGRAUS':local>=2240&&local<2336?'ILHA FIRME A DIREITA':local>=2336?'EMBARQUE NO ELEVADOR 2':'EMBARQUE NO ELEVADOR 1')
        :warehouse?(local>=2336?'ARMAZEM: DESCIDA A DIREITA':'ARMAZEM: TABUA ENTRE SACADAS')
        :riding?(local>2760?'TRANSPORTE: PREPARE A SAIDA':'TRANSPORTE: SIGA A MARGEM')
        :boarding?(carriage!.x<=x+96?'TABLADO NA DOCA: EMBARQUE':'ESPERE O TABLADO NA DOCA')
        :counterpressure&&feet<=GUAIRA_COURSES[id].floor-96?(closedReturn?'SEGUNDA GRELHA FECHADA':'REGISTRO NO ALTO: PULE + BAIXO')
        :inspection&&feet>GUAIRA_COURSES[id].floor+4?(local>=2240?'SAIDA: SUBA PELOS DEGRAUS':isolated?'GRELHA DO CORREDOR FECHADA'
            :local>=2160?'REGISTRO ABAIXO: PULE + BAIXO':'REGISTRO NO TUNEL A DIREITA')
        :inspection&&local<1968?'TAMPA: PULE + BAIXO PARA EXPLORAR'
        :id==='subida'&&local>=2320?'AQUEDUTO: SUBA PELOS PATAMARES'
        :recovering?'APOIO BAIXO: CUIDE DA MARGEM':descending?'DESCIDA: SIGA OS APOIOS':detour&&backtracking?'RETORNO: PROCURE APOIOS'
        :maintaining?(maintained?'GRELHA FECHADA: DESCA A DIREITA':'REGISTRO DE MANUTENCAO A DIREITA')
        :island?'ILHA FIRME: OBSERVE A DESCARGA'
        :sluice&&local<784?(lock?.active?(lock.y===lock.to?.y?'PONTE: SIGA ATE A ILHA':'PONTE SUBINDO: ESPERE')
            :lock&&lock.y!==lock.home?.y?'PONTE DESCENDO: ESPERE':'PLACA ABAIXO / PASSADICO ACIMA')
        :sluice&&local<1024?'SALTE O CANAL NO INTERVALO SECO'
        :detour?'DESVIO ALTO - MOEDAS E RISCO':jet?.active?'REGISTRO FECHADO':jet?'OBSERVE A PRESSAO'
        :foe?'SALTE OU ATAQUE POR CIMA':backtracking?'EXPLORE O CAMINHO DE VOLTA'
        :counterpressure?'DUAS GRELHAS: LEIA CADA CICLO'
        :room.name==='ANDAIMES VIVOS'||room.name==='TABUAS DA GALERIA'?'TABUA RACHADA CEDE':'EXPLORE E SIGA A DIREITA';
    return {name:detour?.name??room.name,hint,detail:control&&hint===control.hint?control.detail
        :fragile?'A tábua está cedendo. Salte para o próximo apoio antes de ela cair.'
        :recovering?'Você caiu no apoio baixo. Observe a margem antes de descer; também é possível subir de volta ao desvio.'
        :descending?'Desça pelos apoios até reencontrar a margem e o caminho principal.'
        :detour&&backtracking?'Volte pelos apoios à esquerda. As tábuas rachadas e a pressão da água continuam ativas.':detour?.hint??room.hint};
}
