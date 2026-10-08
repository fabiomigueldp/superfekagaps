import { authorDeliciaTraversal } from './DeliciaLevelDesign';
import { deliciaAsset } from './DeliciaIsland';
import { DELICIA_PLAYER_HEIGHT } from './DeliciaNative';
/** The expansion is a separate campaign; released World stage IDs stay stable. */
export const DELICIA_ASSETS = deliciaAsset('');
export { DELICIA_ATLAS } from './DeliciaIsland';
export const DELICIA_COLORS = { ink: '#132f37', teal: '#226965', cream: '#fff0cb', orange: '#f7a535', gold: '#edc86c', leaf: '#628b41', plum: '#583653' };
export type Biome = 'harbor' | 'orchard' | 'aqueduct' | 'reservoir' | 'cellar' | 'refinery' | 'citadel';
export type FoeType = 'pulp' | 'beetle' | 'wasp' | 'roller' | 'sentinel' | 'bottler' | 'mimic' | 'bloom';
export interface Box { x: number; y: number; w: number; h: number }
export interface Floor extends Box { material: 'stone' | 'grass' | 'brass' | 'wood'; kind?: 'moving' | 'crumble' | 'spring' | 'belt' | 'lift' | 'bridge'; travel?: number; phase?: number; speed?: number; requiresValve?: string; beltSpeed?: number }
export interface StageZone { x:number; name:string; detail:string; landmark:'port'|'mill'|'arches'|'chalice'|'archive'|'factory'|'garden'|'bell'|'crown' }
export interface StageMachine extends Box { id:string; kind:'jet'|'press'|'wind'; period:number; phase:number; power?:number; disabledBy?:string }
export interface StageEcho { id:string; x:number; y:number; speaker:SceneLine['speaker']; text:string; after?:string }
export interface EnemySpec { kind: FoeType; x: number; y: number; patrol: number }
export interface ValveSpec { x: number; y: number; id: string; label: string; order?: number }
export interface StagePickup { id: string; x: number; y: number; kind: 'orange' | 'memory' | 'seal' | 'heart'; lore?: string }
export interface SceneLine { speaker: 'Feka' | 'Jajá' | 'Guina' | 'Dona Casca'; text: string }
export interface DeliciaStage {
    id: string; number: number; name: string; biome: Biome; subtitle: string; mechanic: string;
    width: number; height: number; spawn: { x: number; y: number }; floors: Floor[]; enemies: EnemySpec[];
    valves: ValveSpec[]; pickups: StagePickup[]; checkpoints: { x: number; y: number }[];
    hazards: (Box & { kind: 'juice' | 'steam' | 'thorns'; period?: number; phase?: number })[];
    gate: Box; intro: SceneLine[]; outro: SceneLine[]; boss?: 'jaja' | 'guina'; optional?: boolean;
    map: { x: number; y: number }; secret?: string;
    zones?:StageZone[]; machines?:StageMachine[]; echoes?:StageEcho[]; parTime?:number;
}
export interface LoreEntry { id: string; title: string; source: string; text: string }
export const DELICIA_LORE: readonly LoreEntry[] = [
    { id: 'carta', title: 'Uma carta cheirando a laranja', source: 'Correio do cais', text: 'Feka, o mar chegou doce hoje. Os navios de Guina recolheram a última safra e as fontes pararam. Jajá não nos deixa passar pelo reservatório. Ele diz que fez uma promessa. Traga um copo vazio. Precisamos lembrar por que construímos a ilha. Assinado: Dona Casca.' },
    { id: 'origem', title: 'A primeira partilha', source: 'Mosaico do pomar', text: 'Antes das caldeiras, cada família plantava uma árvore para outra família. A Delícia não era uma receita secreta: era o nome dado ao primeiro copo oferecido a alguém. A ilha prosperou porque ninguém possuía a nascente. A estátua do cais ainda estende uma mão aberta.' },
    { id: 'fundadores', title: 'Dois homens e um aqueduto', source: 'Diário dos construtores', text: 'Guina projetava máquinas impossíveis. Jajá sabia ouvir a fruta, a água e as pessoas. Juntos construíram o aqueduto que trouxe suco aos bairros altos. O último arco tem duas assinaturas. A de Jajá foi coberta por uma placa de latão, mas continua gravada na pedra.' },
    { id: 'seca', title: 'O ano dos copos vazios', source: 'Registro da colheita', text: 'Uma temporada de tempestades destruiu o pomar do norte. Guina salvou os barris que restavam com uma prensa de emergência. Ninguém esqueceu aquele inverno. Guina também não. Desde então, confunde repartir com desperdiçar e controlar com proteger.' },
    { id: 'contrato', title: 'A promessa de Jajá', source: 'Contrato manchado', text: 'Jajá prometeu guardar a fonte até que a ilha tivesse suco para todos. Guina mudou o medidor: agora ele mede o estoque da cidadela, nunca os copos dos moradores. O guardião continua esperando um número que não chegará. Sua lealdade sustenta uma injustiça que ele não escolheu.' },
    { id: 'gota', title: 'A memória da gota', source: 'Arquivo submerso', text: 'O suco da nascente conserva ecos de quem o compartilhou. Cristais âmbar formam-se onde alguém ofereceu o último gole. Guina chama isso de impureza e filtra as memórias. Por isso sua reserva perfeita não tem gosto de nada. As gotas que você encontra devolvem vozes ao rio.' },
    { id: 'selo', title: 'Os selos da partilha', source: 'Livro de manutenção', text: 'Três selos em cada percurso certificavam que o suco alcançava cais, casas e campos. Viraram troféus de auditoria quando Guina fechou as fontes. Recolhê-los restaura o mapa original. Nenhum selo é necessário para vencer: a partilha precisa continuar mesmo quando a contabilidade falha.' },
    { id: 'casca', title: 'Dona Casca e a cozinha', source: 'Receita na janela', text: 'Dona Casca preparava almoço para os construtores do aqueduto. Ela lembra Jajá rindo antes da primeira caneca e Guina consertando o fogão sem cobrar. Guarda duas cadeiras vazias à mesa. Seu plano não é demolir a fábrica; é trazer os dois de volta para o almoço.' },
    { id: 'pressao', title: 'Uma cidade sob pressão', source: 'Planta de tubulações', text: 'Uma válvula fechada mantém a máquina forte e o bairro fraco. Abrir rotas laterais reduz a pressão das caldeiras. As marcas douradas nas paredes mostram o fluxo antigo. As luzes vermelhas indicam uma carga prestes a escapar. A ilha avisa antes de machucar.' },
    { id: 'jaja', title: 'O guardião do primeiro gole', source: 'Anotação de Jajá', text: 'Eu não guardo um tesouro. Guardo o lugar onde um desconhecido pode se sentar, tomar um suco e sentir que chegou em casa. Se a promessa serve para deixar alguém do lado de fora, será que ainda é a mesma promessa? A página termina com o desenho de um copo sem tampa.' },
    { id: 'guina', title: 'O medo do barão', source: 'Carta nunca enviada', text: 'Jajá, quando os barris acabarem, vão dizer que eu não fui capaz. Sei que você vai oferecer o seu último copo. Eu quero construir uma reserva que não tenha último copo. Preciso de mais uma safra. Depois abrimos as portas. A carta foi escrita sete safras atrás.' },
    { id: 'filtro', title: 'A sala dos filtros', source: 'Relatório da refinaria', text: 'O filtro separa polpa, sementes e lembranças. As sementes viraram munição dos sentinelas. A polpa criou vida nos corredores. As lembranças escorrem para o porão. A refinaria produz ordem na superfície e caos onde ninguém olha. Toda eficiência tem uma conta.' },
    { id: 'eco', title: 'Ai, que delícia', source: 'Eco no reservatório', text: 'O bordão virou o cumprimento da ilha. Uma criança diz ao receber uma fruta, um mecânico ao terminar o turno, Jajá quando alguém volta depois de muito tempo. Guina registrou a frase em todas as garrafas. Uma marca pode comprar as letras. Não pode comprar o sentimento.' },
    { id: 'fermento', title: 'O arquivo vivo', source: 'Adega das memórias', text: 'Cada barril esquecido guarda uma versão diferente da ilha. Nos mais velhos, Guina ainda ri. Nos mais novos, as máquinas abafam todas as vozes. As criaturas de polpa seguem o som dos copos. Não são más; procuram a lembrança de uma mesa cheia.' },
    { id: 'sino', title: 'O sino do meio-dia', source: 'Torre do cais', text: 'Antes, o sino convocava todos para a partilha. Guina transformou suas batidas no horário das entregas. Dona Casca deixou a corda original sob o píer. Quando o rio voltar a correr, o mesmo som terá um significado antigo e novo.' },
    { id: 'feka', title: 'Uma missão sem princesa', source: 'Caderno de Feka', text: 'Vim achando que alguém precisava ser salvo por mim. Encontrei uma ilha que precisava voltar a conversar. Talvez vencer um gap não seja sempre passar na frente de alguém. Talvez seja construir passagem. De qualquer jeito, vou chamar isso de uma grande vitória.' },
    { id: 'canal', title: 'A passagem das raízes', source: 'Raízes do pomar', text: 'As árvores mantêm um canal que contorna o medidor de Guina. Ele não aparece nas plantas oficiais porque ninguém o construiu sozinho. Quem seguir as gotas âmbar encontra um santuário e uma vista da ilha anterior às máquinas.' },
    { id: 'coroa', title: 'A coroa sem tampa', source: 'Oficina da cidadela', text: 'A coroa do barão é uma válvula que nunca abre. Sua armadura devolve golpes enquanto o medidor está cheio. Depois de uma descarga, o latão precisa resfriar. Guina esconde o medo nessa pausa. É a única hora em que você consegue alcançá-lo.' },
    { id: 'recomeço', title: 'Depois da última caldeira', source: 'Mesa da partilha', text: 'Jajá levou os primeiros copos ao cais. Guina começou a desmontar o medidor, devagar. Ninguém perdoou a fome com uma piada; cada bairro escolheu como reparar sua fonte. A ilha continuou grande. O tesouro ficou espalhado em pequenas mesas.' },
    { id: 'delicia', title: 'A Delícia é de todos', source: 'Inscrição restaurada', text: 'A Delícia não pertence a quem a inventou, engarrafou ou guardou. Existe no instante em que alguém oferece e outro aceita. O nome da ilha permaneceu. Mudou a palavra gravada na entrada: de RESERVA para BEM-VINDO.' },
];

interface ChapterSpec { name: string; biome: Biome; subtitle: string; mechanic: string; map: [number, number]; heights: number[]; gaps: number[]; kinds: FoeType[]; lore: string[]; boss?: 'jaja' | 'guina' }
const CHAPTERS: readonly ChapterSpec[] = [
    { name: 'Cais do Primeiro Gole', biome: 'harbor', subtitle: 'Uma carta. Um copo vazio. Uma ilha inteira.', mechanic: 'Saltos, sementes e o primeiro registro', map: [.19, .79], heights: [450,450,420,450,450,390,420,450,450,420,390,420,450,450,420,450], gaps: [60,70,55,80], kinds: ['pulp','beetle'], lore: ['origem','sino'] },
    { name: 'Pomares da Partilha', biome: 'orchard', subtitle: 'As raízes ainda lembram o caminho.', mechanic: 'Molas cítricas e trilhas na copa', map: [.29,.68], heights: [450,420,390,420,450,450,390,360,390,420,450,420,390,450,420,450,450], gaps: [75,90,65,100], kinds: ['pulp','beetle','wasp'], lore: ['fundadores','casca'] },
    { name: 'Aqueduto dos Ecos', biome: 'aqueduct', subtitle: 'Escute a água antes de abrir a válvula.', mechanic: 'Válvulas em sequência e rota secreta', map: [.37,.56], heights: [450,420,390,420,450,390,360,390,420,450,420,390,420,450,390,420,450], gaps: [85,90,100,70], kinds: ['wasp','sentinel'], lore: ['pressao','canal'] },
    { name: 'Cascatas de Âmbar', biome: 'reservoir', subtitle: 'A nascente canta por baixo do ruído.', mechanic: 'Plataformas flutuantes e jatos sinalizados', map: [.48,.67], heights: [450,420,450,390,420,450,420,390,450,420,450,390,420,390,450,420,450], gaps: [100,110,80,95], kinds: ['wasp','roller','pulp'], lore: ['gota','eco'] },
    { name: 'Arquivo Fermentado', biome: 'cellar', subtitle: 'O que a fábrica esqueceu ganhou vida.', mechanic: 'Passarelas frágeis e barris impostores', map: [.53,.52], heights: [450,450,420,390,420,450,450,420,390,420,450,420,450,390,420,450,450,420], gaps: [85,110,75,100], kinds: ['mimic','pulp','bottler'], lore: ['contrato','fermento'] },
    { name: 'Jajá, Guardião da Nascente', biome: 'reservoir', subtitle: 'Uma promessa não pode fechar uma fonte.', mechanic: 'Leia a caneca, salte a onda e ataque na pausa', map: [.62,.43], heights: [], gaps: [], kinds: [], lore: [], boss: 'jaja' },
    { name: 'Maré de Laranja', biome: 'reservoir', subtitle: 'O rio voltou. As máquinas resistem.', mechanic: 'Correntes, balsas e saltos em corrida', map: [.63,.65], heights: [450,420,450,450,390,420,450,420,390,420,450,450,420,390,420,450,420,450], gaps: [120,110,100,95], kinds: ['roller','wasp','bottler'], lore: ['jaja','seca'] },
    { name: 'Engrenagens da Polpa', biome: 'refinery', subtitle: 'Desarme a pressão que alimenta o trono.', mechanic: 'Esteiras, prensas e sementes ricocheteadas', map: [.70,.54], heights: [450,420,450,390,420,450,420,390,450,420,390,420,450,420,390,450,450,420], gaps: [100,110,90,120], kinds: ['sentinel','roller','bottler'], lore: ['filtro','guina'] },
    { name: 'O Jardim Proibido', biome: 'orchard', subtitle: 'Uma safra inteira atrás de um portão.', mechanic: 'Abelhas, copa alta e santuário opcional', map: [.77,.42], heights: [450,420,390,420,360,390,420,450,390,360,390,420,450,390,420,450,420,450], gaps: [100,120,95,85], kinds: ['wasp','beetle','mimic'], lore: ['selo','feka'] },
    { name: 'Caldeira do Último Copo', biome: 'refinery', subtitle: 'Todo excesso procura uma saída.', mechanic: 'Descargas alternadas e passarelas de manutenção', map: [.83,.30], heights: [450,420,390,450,420,390,420,450,420,390,450,420,390,420,450,420,450,390], gaps: [115,90,120,100], kinds: ['bottler','sentinel','roller'], lore: ['coroa','fundadores'] },
    { name: 'A Escadaria da Reserva', biome: 'citadel', subtitle: 'No alto, o silêncio também pesa.', mechanic: 'Combinação final de válvulas, prensas e corrida', map: [.72,.22], heights: [450,420,390,420,360,390,420,450,420,390,420,360,390,420,450,390,420,450,450], gaps: [110,125,90,115], kinds: ['sentinel','wasp','mimic','bottler'], lore: ['casca','coroa'] },
    { name: 'Paulo Guina, Barão da Delícia', biome: 'citadel', subtitle: 'A Delícia é de todos.', mechanic: 'Três fases, pressão crescente e duas válvulas de alívio', map: [.86,.14], heights: [], gaps: [], kinds: [], lore: [], boss: 'guina' },
];

const materialFor = (biome: Biome): Floor['material'] => biome === 'orchard' ? 'grass' : biome === 'refinery' || biome === 'citadel' ? 'brass' : biome === 'harbor' ? 'wood' : 'stone';
function makeStage(spec: ChapterSpec, index: number): DeliciaStage {
    const number = index + 1, id = `delicia-${number}`, material = materialFor(spec.biome);
    const s: DeliciaStage = { id, number, name: spec.name, biome: spec.biome, subtitle: spec.subtitle, mechanic: spec.mechanic,
        width: 0, height: 900, spawn: { x: 90, y: 450-DELICIA_PLAYER_HEIGHT }, floors: [], enemies: [], valves: [], pickups: [], hazards: [], checkpoints: [],
        gate: { x: 0, y: 360, w: 50, h: 90 }, intro: [], outro: [], map: { x: spec.map[0], y: spec.map[1] }, ...(spec.boss ? { boss: spec.boss } : {}) };
    if (spec.boss) {
        s.width = 1340; s.floors = [{ x: 0, y: 450, w: 1340, h: 450, material },
            { x: 735, y: 380, w: 115, h: 18, material }, { x: 1015, y: 380, w: 120, h: 18, material }];
        s.gate = { x: 1250, y: 360, w: 60, h: 90 }; s.checkpoints = [{ x: 130, y: 450-DELICIA_PLAYER_HEIGHT }];
        s.valves = [{ id: 'left', x: 260, y: 450, label: 'ALÍVIO I' }, { id: 'right', x: 1100, y: 380, label: 'ALÍVIO II' }];
        s.intro = spec.boss === 'jaja' ? [
            { speaker: 'Jajá', text: 'Ai, que delícia! Mas cuidado com a pressão da caneca!' },
            { speaker: 'Jajá', text: 'Guardo esta fonte até existir suco para todos. Foi a minha promessa.' },
            { speaker: 'Feka', text: 'Então olha para o cais. Os copos estão vazios, Jajá.' },
            { speaker: 'Jajá', text: 'Mostre que sabe cuidar da nascente. Uma promessa merece um desafio.' },
        ] : [{ speaker: 'Guina', text: 'Olha quem chegou. Feka, você dá trabalho... mas eu gostei de você. Namora comigo.' },
            { speaker: 'Feka', text: 'Eu vim abrir as fontes, Guina. Pedido de namoro não fecha o assunto.' },
            { speaker: 'Guina', text: 'Vai fugir? Vou te deixar oco, Feka! Você vai tomar o maior gap desta ilha!' },
            { speaker: 'Jajá', text: 'Feka decide por ele. E o suco é de todos. Olha para as marcas antes dos golpes!' }];
        s.outro = spec.boss === 'jaja' ? [{ speaker: 'Jajá', text: 'Eu prometi proteger a partilha. Acabei protegendo o portão. Vamos consertar isso.' }, { speaker: 'Feka', text: 'Você abre o rio. Eu abro o caminho até Guina.' }]
            : [{ speaker: 'Guina', text: 'Tá bom. Sem gap, sem ameaça. Mas ainda posso te chamar para um suco?' }, { speaker: 'Feka', text: 'Pode convidar. Eu escolho se aceito. Primeiro devolve a safra.' }, { speaker: 'Jajá', text: 'Agora vem. Dona Casca guardou duas cadeiras, e a mesa cabe mais gente.' }];
        return s;
    }
    authorDeliciaTraversal(s,spec.lore);
    s.intro = number === 1 ? [{ speaker: 'Dona Casca', text: 'Bem-vindo à Delícia. Guina levou a safra inteira, e as nossas fontes secaram.' }, { speaker: 'Feka', text: 'Um grande vilão? Finalmente uma missão com suco!' }, { speaker: 'Dona Casca', text: 'Abra as duas válvulas de cada percurso. E ouça as memórias: esta ilha tem mais que um lado.' }]
        : [{ speaker: number<6?'Dona Casca':'Jajá', text: number===3?'Abra primeiro a fonte do bairro, depois a do cais. O aqueduto precisa voltar a lembrar o trajeto.':number===7?'A nascente voltou a correr! Segure Shift para correr e salte nas travessias. As balsas ajudam a alcançar a outra margem.':number===8?'As esteiras empurram você e os inimigos. Rebata os projéteis com Q: latão contra latão.':number===11?'O medidor alimenta a armadura de Guina. Abra as válvulas quando ele carregar o ataque.':spec.subtitle }];
    if (number===3) s.secret='delicia-raizes'; if(number===9) s.secret='delicia-relogio';
    return s;
}
export const DELICIA_STAGES: readonly DeliciaStage[] = CHAPTERS.map(makeStage);
function shrine(id: string, name: string, biome: Biome, parent: number): DeliciaStage {
    const roots=id==='delicia-raizes',spec:ChapterSpec={...CHAPTERS[parent],
        heights:roots?[450,420,360,390,420,390,450,420,360,390,420,450,390,360,390,420,450,420,450]:[450,390,420,450,390,420,360,390,420,450,390,420,450,390,420,360,390,420,450,420,450],
        gaps:roots?[95,110,85,105]:[100,95,85,105],kinds:roots?['wasp','beetle','pulp']:['bottler','roller','sentinel']};
    const s=makeStage(spec,parent); s.id=id; s.name=name; s.biome=biome; s.optional=true; s.mechanic=roots?'Uma rota própria pelas copas, com molas e selos altos':'Um desvio de precisão entre esteiras e descargas do sino';s.intro=[{speaker:'Dona Casca',text:roots?'Siga os selos por cima das raízes. O desvio guarda uma lembrança que nenhuma máquina conseguiu filtrar.':'O sino marca cada descarga. Atravesse as prensas entre as batidas. Não há pressa para sair daqui.'}];
    s.pickups=s.pickups.map(p=>({...p,id:`${id}:${p.id.split(':')[1]}`, ...(p.kind==='memory'?{lore:id==='delicia-raizes'?'canal':'sino'}:{})}));
    authorDeliciaTraversal(s,roots?['canal','origem']:['sino','fundadores']);
    s.secret=undefined; s.outro=[{speaker:'Feka',text:'Um caminho que não aparecia no mapa. Ainda bem que alguém deixou as sementes.'}]; return s;
}
export const DELICIA_SHRINES = [shrine('delicia-raizes','Santuário das Raízes','orchard',1), shrine('delicia-relogio','Sino da Última Safra','refinery',9)] as const;
export const ALL_DELICIA_STAGES: readonly DeliciaStage[] = [...DELICIA_STAGES,...DELICIA_SHRINES];
export const deliciaStageById = (id: string): DeliciaStage | undefined => ALL_DELICIA_STAGES.find(s=>s.id===id);
export const DELICIA_ENDING: readonly SceneLine[] = [
    {speaker:'Dona Casca',text:'O primeiro barril chegou ao cais. Ainda falta reparar muita coisa. Mas hoje todo mundo tem um copo.'},
    {speaker:'Jajá',text:'Ai, que delícia. Não do suco sozinho. De ver a mesa cheia.'},
    {speaker:'Guina',text:'Amanhã eu tiro a placa da última fonte. Você me ajuda, Jajá?'},
    {speaker:'Feka',text:'Outra ilha salva por Feka! ...Tá bom. Por Feka, Jajá, Dona Casca e todo mundo que abriu uma válvula.'},
];
