# Chegada ao salão Calabrezzo — contrato de arte

Base remota verificada: `main` em `1fad188374d84b46acfec50bbd5a0753e07171a7`.
Branch isolada: `art/turbosuco-factory-arrival`. `vercel.json` permanece com
`git.deploymentEnabled=false`. Nenhuma alteração de campanha, física, saves,
entrypoints, `juice-lab.ts`, epílogo, Oracle ou configuração de deploy.

## Entrega e direção

`src/adventure/experimental/JuiceFactoryArrivalArt.ts` fornece fachada procedural,
placa de orientação e adaptador para o retângulo de entrada controlado pelo runtime.
O anexo é construído em aço azulado corrugado, com rebites, cobre e visor de gosma
roxa. Coroa e halteres anunciam o campeonato; cortinas vinho e soleira âmbar
antecipam o palco existente. A abertura escura tem profundidade sem criar um degrau.

Não há imagem promocional aplicada ao cenário, fruta, ingrediente, áudio, personagem
novo ou reconstrução do salão/arena. A própria arte Canvas é o asset de jogo e seu
fallback: não necessita PNG, rede, fonte externa, Blender ou imagem gerada. A
redução de movimento é nativa: a fachada e a placa são estáticas em todos os estados.

## Contrato recebido da frente de runtime

Frente: `01a0fe83-cd37-7252-b107-ed39b6b680e0`.

| Elemento | Coordenadas / responsabilidade |
| --- | --- |
| Fase e suporte | `3-3`; patamar físico `x=1664…1920`, topo `y=224` |
| Interação | Runtime: `{x:1776,y:184,width:24,height:40}`; ação explícita |
| Âncora da arte | Centro inferior do gatilho: `(1788,224)` |
| Fachada | 144×112; extensão `x=1716…1860`, `y=112…224` |
| Abertura visual | 32×46; extensão `x=1772…1804`, `y=178…224`; contém o gatilho |
| Placa | 48×40; poste em `(1688,224)`; extensão `x=1664…1712`, `y=184…224` |
| Prova de câmera | `(1600,64)`: porta em `(188,160)`, topo da coroa em `y=48` |
| Salão/encerramento | 320×180; piso de tela em 160; arte original |
| Combate | Câmera `(0,64)` e piso físico 224; arte original |
| Retorno | Runtime restaura fase suspensa; módulo artístico não participa |

Não há colisão nem trigger no módulo. Os retângulos acima são limites visuais;
o gatilho menor é intencionalmente contido na abertura maior. Não ampliar a colisão
para acompanhar a fachada. O piso real deve ser pintado depois da soleira.

```ts
// No render da fase 3-3, depois de drawLandmarks(...), antes de terrain/actors/HUD.
// portal e status pertencem à frente de runtime; nenhuma segunda tabela de progresso.
drawJuiceArrivalSign(ctx, 1688 - cx, 224 - cy, 'right');
drawJuiceArrivalAtPortal(ctx, portal, {x: cx, y: cy}, status);
```

Usar os mesmos `cx/cy` arredondados (incluindo shake) do restante de WorldGame.
`open` mostra cortinas e luz de entrada; `closed` mostra persiana e cadeado;
`complete` adiciona faixa e “CONCLUÍDO”. São estados visuais, não decisões de acesso.
Não inverter horizontalmente o canvas para mudar a direção da placa: passar `left`.

O checkpoint existente no tile 107 (`x=1712`) fica junto à borda esquerda da fachada.
Preservar a ordem atual: bandeira depois da arte, para permanecer visível e acessível.
A prova inclui essa bandeira. Tubulações de fundo passam por trás do anexo.
Não há incompatibilidade de suporte identificada; os 16 tiles do patamar foram
conferidos na campanha desta base. Câmeras diferentes exigem manter a coroa abaixo
do HUD; não há pan/zoom ou recenter de câmera imposto pela arte.

A transição visual usa a mesma coroa, letreiro de campeonato, cortinas e luz quente
do palco; o cobre e a mistura roxa continuam até a contenção. Reutilizar a transição
existente de JuiceIntroDirector/JuiceIntroArt. Não adicionar câmera animada, novo
epílogo ou overlay que esconda a ação.

## Evidências e reprodução

- [Desktop: patamar real, salão e arena](desktop.png)
- [390×844, movimento reduzido](mobile-reduced-motion.png)
- [Aberto, pixels nativos](open-native.png), [fechado](closed-native.png), [concluído](complete-native.png)
- [Medições do navegador](validation.json)

`npm ci --cache /tmp/feka-npm-cache`, depois `npm run dev -- --host 127.0.0.1 --open false`.
Abrir `/tools/art/juice-arrival/`. A página de revisão não está nos entrypoints do build.
Para repetir as capturas sem alterar dependências do repositório:

```sh
npm install --prefix /tmp/feka-browser --cache /tmp/feka-npm-cache playwright
PLAYWRIGHT_PACKAGE_JSON=/tmp/feka-browser/package.json node tools/art/juice-arrival/verify.mjs
```

`CHROMIUM_PATH` e `PROOF_ORIGIN` são opcionais. A prova usa Chromium local,
bloqueia imagens/fontes/áudio externos e verifica: ausência de erro, três estados,
limites exatos, isolamento de contexto, âncora inválida, determinismo, adaptação do
portal, suporte real e ausência de overflow em 390 px. Capturas são pixels reais
do Canvas; não mockups. O Feka usa o sprite original, sem hipertrofia.

Validação: 1.303 testes existentes passaram; `npm run build` e `npm run typecheck`
passaram; TypeScript da página de prova também checado separadamente. Fachada:
15.082 pixels opacos, 144×112 de extensão, nenhum pixel abaixo do piso. Benchmark
local: aproximadamente 0,3 ms por chamada (30 lotes de 100); consultar JSON para
medição final. Não representa FPS de dispositivo móvel ou custo total da fase.
Bundle isolado minificado com BitmapFont: 7.423 bytes, 2.802 bytes gzip; a fonte
já compartilhada no jogo reduz o custo incremental de integração. Zero texturas
de runtime. PNGs e HTML de prova não entram no build de produção.

## Fontes inspecionadas e limites

Fontes reais: `WorldBackdrop.ts`, `WorldPainting.ts`, `WorldScenery.ts`,
`WorldTerrain.ts`, `WorldGame.ts`, `campaign.ts` (somente leitura),
`CalabrezzoStageArt.ts`, `JuiceIntroArt.ts`, `JuiceIntroDirector.ts`,
`JuiceArenaPainter.ts`, `BitmapFont.ts`, `playerSpriteSpec.ts`, e capturas
preexistentes `output/turbosuco/intro.png` e `arena.png`.
Não existem `.agents/skills` locais neste checkout/ambiente. Foi consultada a skill
`vercel:agent-browser-verify`; a verificação principal reproduzível usa Playwright
com Chromium local, sem serviços externos.

Ainda cabe à frente de runtime ligar a chamada de desenho, o prompt acessível de
interação e o fluxo entrada/retorno. Esta branch não prova o percurso jogável completo,
persistência, touch físico ou montagem conjunta com a branch irmã. A leitura a 1×
foi inspecionada em 390 px: título e placa são bitmap 5×7; o runtime deve manter seu
prompt DOM acessível e não depender exclusivamente de texto pequeno no cenário.
