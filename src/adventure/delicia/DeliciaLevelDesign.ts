import type { DeliciaStage, Floor, FoeType, StageZone } from './DeliciaContent';

type Setpiece = 'quay' | 'canopy' | 'sluice' | 'falls' | 'cellar' | 'tide' | 'presses' | 'garden' | 'boiler' | 'ascent' | 'roots' | 'clock';
interface Section { name:string; detail:string; landmark:StageZone['landmark']; spans:readonly (readonly [number,number,number])[] }
interface RoutePlan { piece:Setpiece; time:number; sections:readonly Section[] }
// Each tuple is [usable landing width, altitude, gap after it]. These are authored
// encounter spaces, not a random level seed; the safe route and reward route differ.
const section=(name:string, detail:string, landmark:Section['landmark'], spans:Section['spans']):Section=>({name,detail,landmark,spans});
const PLANS:Record<string,RoutePlan> = {
 '1':{piece:'quay',time:90,sections:[
  section('O cais de copos vazios','O primeiro gole sempre foi de quem chegava.','port',[[510,450,45],[270,450,65],[350,425,55]]),
  section('Mercado das Janelas','As bancas estão fechadas. A fonte ainda pode abrir.','port',[[390,425,60],[260,400,65],[370,430,70]]),
  section('Pontes da Maré Mansa','Espere a balsa se aproximar ou use o impulso.','arches',[[290,450,100],[310,420,100],[350,450,65]]),
  section('O sino que não toca','Devolva ao cais o som do meio-dia.','bell',[[350,430,75],[290,400,65],[510,450,0]])]},
 '2':{piece:'canopy',time:105,sections:[
  section('Terraços da Primeira Safra','Sementes no chão. Segredos na copa.','mill',[[430,450,75],[280,420,80],[320,390,70]]),
  section('O Moinho Adormecido','As molas alcançam os galhos mais altos.','mill',[[400,420,85],[290,390,95],[380,420,75]]),
  section('Correio das Abelhas','O vento sobe entre as árvores em flor.','garden',[[340,450,95],[250,420,105],[330,390,90]]),
  section('A árvore de outra família','Uma árvore plantada para alguém que você ainda não conhece.','garden',[[310,420,85],[280,390,95],[510,450,0]])]},
 '3':{piece:'sluice',time:105,sections:[
  section('As Duas Assinaturas','A pedra lembra quem construiu o aqueduto.','arches',[[440,450,80],[320,420,90],[300,390,95]]),
  section('Comporta do Bairro','Abra a primeira fonte. Veja a passagem superior surgir.','arches',[[440,420,95],[290,390,100],[360,420,80]]),
  section('Nove Arcos de Memória','Uma semente atravessa o silêncio antes de você.','arches',[[280,450,105],[290,420,110],[350,390,90]]),
  section('Comporta do Cais','O fluxo precisa chegar a quem mora embaixo.','chalice',[[430,420,85],[300,390,100],[500,450,0]])]},
 '4':{piece:'falls',time:112,sections:[
  section('Mirante das Cinco Quedas','A ilha inteira respira por este cânion.','chalice',[[440,450,95],[300,420,100],[300,450,110]]),
  section('Elevadores de Âmbar','Entre no jato quando ele abrir para alcançar a varanda.','arches',[[410,420,105],[280,390,115],[370,450,95]]),
  section('Ponte do Arco-Íris','Balsas carregam seus saltos. Não lute contra o rio.','arches',[[320,420,110],[260,390,120],[360,420,100]]),
  section('A Voz da Nascente','Os cristais guardam vozes de uma mesa cheia.','chalice',[[430,450,100],[310,420,95],[500,450,0]])]},
 '5':{piece:'cellar',time:118,sections:[
  section('Catálogo dos Esquecidos','Nem todo barril guarda somente suco.','archive',[[430,450,90],[310,450,95],[300,420,105]]),
  section('Prateleiras que Suspiram','As tábuas racham primeiro, caem depois e se recompõem.','archive',[[440,420,100],[280,390,105],[350,420,100]]),
  section('O Contrato Rasurado','A promessa foi escrita a duas mãos. Só uma alterou o medidor.','archive',[[320,450,95],[280,420,110],[380,390,90]]),
  section('Arquivo das Vozes Vivas','Leve a lembrança até Jajá.','chalice',[[420,420,95],[300,450,100],[520,450,0]])]},
 '7':{piece:'tide',time:115,sections:[
  section('O Rio Desperto','Jajá abriu a nascente. Agora o caminho se move.','chalice',[[440,450,110],[280,450,115],[330,420,105]]),
  section('Doca das Balsas Perdidas','Escolha o ritmo do rio para poupar o impulso.','port',[[420,450,115],[290,420,120],[370,450,110]]),
  section('Velas de Casca','As correntes levam sementes e segredos.','mill',[[320,420,115],[270,390,125],[350,420,110]]),
  section('A Enseada da Volta','O primeiro barril livre já alcançou a vila.','port',[[430,450,110],[290,420,115],[520,450,0]])]},
 '8':{piece:'presses',time:124,sections:[
  section('Portaria da Polpa','As máquinas continuam cobrando uma safra que já voltou.','factory',[[450,450,90],[290,420,105],[330,450,100]]),
  section('Linha de Engarrafamento','A sirene e a sombra avisam antes de cada prensa.','factory',[[480,420,95],[320,390,110],[370,420,100]]),
  section('O Filtro de Lembranças','Rebata o disparo, atordoe o sentinela, atravesse.','archive',[[330,450,110],[290,420,115],[360,390,100]]),
  section('A Saída de Emergência','Abrir a fonte também desliga uma prensa.','factory',[[460,420,100],[310,450,105],[520,450,0]])]},
 '9':{piece:'garden',time:120,sections:[
  section('A Safra que Ninguém Viu','Há frutas demais para uma ilha com fome.','garden',[[430,450,90],[300,420,100],[330,390,95]]),
  section('Estufa de Vidro Verde','Flores abrem antes de lançar suas sementes.','garden',[[440,420,100],[280,390,115],[370,420,100]]),
  section('Os Jardins Suspensos','Molas, correntes de ar e uma rota acima dos guardas.','mill',[[320,450,105],[270,420,120],[370,390,100]]),
  section('A Corda Esquecida','O sino antigo ainda tem uma passagem.','bell',[[430,420,95],[310,390,110],[520,450,0]])]},
 '10':{piece:'boiler',time:130,sections:[
  section('A Sala do Medidor','Sete safras. A reserva nunca esteve cheia o bastante.','factory',[[450,450,100],[310,420,105],[320,390,115]]),
  section('Fornalha da Última Gota','Uma máquina forte não precisa de um bairro fraco.','factory',[[500,420,105],[300,450,115],[370,420,100]]),
  section('Chaminés de Contratempo','Siga a sequência dos avisos, não a pressa.','factory',[[330,390,110],[280,420,120],[360,450,105]]),
  section('A Válvula sem Coroa','Abra o retorno antes de subir para o barão.','crown',[[450,420,105],[300,390,110],[530,450,0]])]},
 '11':{piece:'ascent',time:135,sections:[
  section('A Escadaria das Sete Safras','Tudo que você aprendeu cabe neste último caminho.','crown',[[440,450,100],[300,420,110],[330,390,115]]),
  section('Galeria das Promessas','A pedra sobe. A memória pesa.','archive',[[450,420,105],[280,390,120],[380,420,105]]),
  section('O Pátio da Reserva','Cuidado com os guardas entre uma descarga e outra.','factory',[[330,450,115],[290,420,125],[360,390,105]]),
  section('À Mesa do Barão','Um copo vazio. Uma última porta.','crown',[[470,420,110],[310,390,110],[560,450,0]])]},
 'delicia-raizes':{piece:'roots',time:100,sections:[
  section('Debaixo do Nome das Árvores','Nenhuma máquina desenhou este caminho.','garden',[[450,450,90],[280,420,100],[300,390,95]]),
  section('A Capela das Sementes','Use as flores de impulso para alcançar a memória.','garden',[[420,420,95],[290,390,105],[350,420,100]]),
  section('Raízes que Fazem Pontes','O vento une as copas.','mill',[[300,450,105],[280,420,110],[360,390,100]]),
  section('A Primeira Mesa','O santuário pertence a quem partilha.','chalice',[[430,420,100],[300,390,95],[500,450,0]])]},
 'delicia-relogio':{piece:'clock',time:110,sections:[
  section('O Sino da Última Safra','Escute uma volta inteira antes de atravessar.','bell',[[450,450,95],[290,420,100],[320,390,100]]),
  section('Pêndulos da Colheita','As máquinas marcam um ritmo; você escolhe quando entrar.','factory',[[460,420,100],[300,450,110],[360,420,105]]),
  section('O Contrapeso de Latão','Pegue o elevador para a varanda do sino.','bell',[[330,390,100],[280,420,115],[350,450,100]]),
  section('Meio-dia Outra Vez','O som deixa de cobrar entregas e volta a chamar pessoas.','bell',[[440,420,105],[310,390,100],[520,450,0]])]},
};

export function authorDeliciaTraversal(s:DeliciaStage,lore:readonly string[]):void {
 const plan=PLANS[s.optional?s.id:String(s.number)];if(!plan||s.boss)return;
 const kinds:Record<Setpiece,readonly FoeType[]>={quay:['pulp','beetle'],canopy:['beetle','wasp','bloom'],sluice:['sentinel','wasp'],falls:['wasp','pulp'],cellar:['mimic','bottler','pulp'],tide:['roller','wasp'],presses:['sentinel','bottler','roller'],garden:['bloom','wasp','mimic'],boiler:['bottler','sentinel'],ascent:['sentinel','mimic','bottler','wasp'],roots:['bloom','beetle','wasp'],clock:['roller','bottler']};
 const material:Floor['material']=s.biome==='harbor'?'wood':s.biome==='orchard'?'grass':s.biome==='refinery'||s.biome==='citadel'?'brass':'stone';
 s.floors=[];s.enemies=[];s.pickups=[];s.valves=[];s.hazards=[];s.checkpoints=[];s.zones=[];s.machines=[];s.echoes=[];s.parTime=Math.round(plan.time*.45);
 let x=0,serial=0;
 const fruit=(px:number,py:number)=>s.pickups.push({id:`${s.id}:fruit-${serial++}`,x:px,y:py,kind:'orange'});
 const citrus=['canopy','garden','roots'].includes(plan.piece),industrial=['presses','boiler','ascent','clock'].includes(plan.piece),water=['falls','tide'].includes(plan.piece);
 plan.sections.forEach((section,zone)=>{
  s.zones!.push({x,name:section.name,detail:section.detail,landmark:section.landmark});
  section.spans.forEach(([landingWidth,y,gap],part)=>{
   // Checkpoints, the upper route and its valve each need their own landing space.
   const w=part===0&&zone>0?Math.max(520,landingWidth):landingWidth;
   const ground:Floor={x,y,w,h:900-y,material};
   if(industrial&&part===1){ground.kind='belt';ground.beltSpeed=zone%2?100:-85;}
   s.floors.push(ground);
   if(zone>0&&part===0){s.checkpoints.push({x:x+30,y:y-54});s.pickups.push({id:`${s.id}:heart-${zone}`,x:x+50,y:y-112,kind:'heart'});}
   // A quiet landing before each encounter and room to read the next hazard.
   for(let c=0;c<4;c++)fruit(x+(part===0&&zone>0?155:65)+c*45,y-35-(c%3===1?18:0));
   const steamLane=industrial&&part===1&&(plan.piece==='boiler'||plan.piece==='clock');
   if((part===1||part===2)&&!(zone===0&&part===1)&&!steamLane){
    const pool=kinds[plan.piece],kind=pool[(zone*2+part)%pool.length];
    const besidePress=industrial&&part===1;
    s.enemies.push({kind,x:x+(besidePress?w-80:w*.55),y:y-44,patrol:besidePress?40:Math.min(135,w-135)});
   }
   if(part===0&&zone>0){
    const lift=citrus||water||plan.piece==='clock',upper=y-95;
    s.floors.push({x:x+255,y:upper,w:145,h:20,material,kind:plan.piece==='cellar'?'crumble':plan.piece==='sluice'?'bridge':undefined,...(plan.piece==='sluice'?{requiresValve:zone<3?'v5':'v11'}:{})});
    if(lift)s.floors.push({x:x+170,y:y-12,w:64,h:12,material,kind:citrus?'spring':'lift',travel:88,speed:1.1,phase:zone*.9});
    s.pickups.push({id:`${s.id}:s${zone}`,x:x+382,y:upper-32,kind:'seal'});
    for(let c=0;c<3;c++)fruit(x+265+c*38,upper-30);
    // Vents are helpful movement machines, visually different from dangerous steam.
    if(water)s.machines!.push({id:`jet-${zone}`,kind:'jet',x:x+425,y:y-100,w:40,h:100,period:4.4,phase:zone*.4,power:800});
    if(citrus&&zone===2)s.machines!.push({id:'canopy-wind',kind:'wind',x:x+225,y:y-260,w:175,h:160,period:7,phase:0,power:0});
   }
   if((zone===1||zone===3)&&part===0){
    const id=zone===1?'v5':'v11';s.valves.push({id,x:x+105,y,label:zone===1?'FONTE DO BAIRRO':'FONTE DO CAIS',...(['sluice','boiler'].includes(plan.piece)?{order:zone===1?1:2}:{})});
    s.pickups.push({id:`${s.id}:m${zone===1?5:11}`,x:x+w-35,y:y-34,kind:'memory',lore:lore[zone===1?0:1]});
   }
   if(industrial&&part===1){
    s.machines!.push({id:`press-${zone}`,kind:'press',x:x+90,y:y-210,w:70,h:210,period:4.5-zone*.16,phase:zone*.8,disabledBy:zone>=2?'v11':'v5'});
    if(plan.piece==='boiler'||plan.piece==='clock')s.hazards.push({kind:'steam',x:x+w-55,y:y-105,w:30,h:105,period:4.8,phase:zone*1.2});
   }
   if(plan.piece==='cellar'&&part===1){
    s.floors.push({x:x+30,y:y-88,w:80,h:16,material:'wood',kind:'crumble'},{x:x+145,y:y-115,w:90,h:16,material:'wood',kind:'crumble'});
    fruit(x+180,y-143);
   }
   if(gap>0){
    s.hazards.push({kind:'juice',x:x+w,y:570,w:gap,h:330});
    if(water||plan.piece==='quay'&&zone===2||plan.piece==='ascent'&&zone===1){
     const ferryWidth=Math.min(58,gap-16);
     s.floors.push({x:x+w+6,y:y+17,w:ferryWidth,h:16,material:'wood',kind:'moving',travel:gap-ferryWidth-12,speed:water?1.2:1.6,phase:zone+part*.7});
    }
   }
   x+=w+gap;
  });
 });
 s.width=x;s.gate={x:x-115,y:355,w:65,h:95};
 s.echoes=plan.sections.slice(1).map((z,i)=>({id:`${s.id}:echo-${i}`,x:s.zones![i+1].x+125,y:380,speaker:s.number<6?'Dona Casca':'Jajá',text:z.detail}));
 s.mechanic={quay:'Pontes de maré, mercado e a primeira fonte',canopy:'Molas, correntes ascendentes e rotas pela copa',sluice:'Comportas em sequência reconstroem pontes',falls:'Balsas, elevadores e jatos de impulso',cellar:'Barris vivos e passarelas que se recompõem',tide:'Correntes, balsas e impulso sobre o rio',presses:'Esteiras opostas e prensas desligadas pelas fontes',garden:'Flores lançadoras, vento e jardins suspensos',boiler:'Prensas, descargas alternadas e controle de pressão',ascent:'O encontro de todas as mecânicas da ilha',roots:'Molas e vento até o santuário das copas',clock:'Prensas em ritmo, elevadores e o sino'}[plan.piece];
}
