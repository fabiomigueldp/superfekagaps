# Perseguição — captura de Feka e leitura das derrotas

19.10.2026. Escopo: derrota durante a perseguição do Flávio Hipotético.

## Diagnóstico do código

O corpo do perseguidor e os projéteis entravam pelo mesmo retorno `hurt` de `HypotheticalModel.contact`. `WorldGame.hurt` aplicava a proteção nativa e depois `Player.die('hit')`; todos os contatos fatais usavam o mesmo salto de derrota. A morte por queda ocorria apenas abaixo do mapa, e `Renderer.drawPlayer` deixava de desenhar Feka sem uma entrada na água. Durante a derrota, o modelo do chefe parava de avançar, congelando destroços e reações em andamento.

A caixa de contato do dinossauro fica no corpo; o personagem pode estar junto ao peito, principalmente depois de perder o capacete. Levar Feka diretamente à boca criaria um salto de posição. A nova sequência parte da posição real, faz um arco curto de impacto e só então passa a desenhar o personagem preso à mandíbula.

## Implementação

- `HypotheticalModel` associa a causa aos mesmos retângulos de colisão que já eram usados. A ordem permanece a mesma, inclusive no último trecho de uma bala antes de atingir uma cobertura. O hospedeiro inicia a apresentação somente depois de a regra nativa declarar a morte. Capacete, invencibilidade, dimensões de colisão e velocidade da perseguição mantêm suas regras.
- `HypotheticalChaseDefeat` usa exclusivamente o tempo nativo de morte. Captura: 65 ms de impacto, contato com a boca em 390 ms, fechamento da mandíbula em 445 ms, sustentação até 500 ms, levantamento até 740 ms, engolida de 850 a 1150 ms, expiração em 1240 ms, fechamento de tela de 1410 a 1710 ms e reinício automático em 1910 ms. O comando R existente continua disponível.
- O movimento dos pés é capturado na postura inicial e assenta na freada. A respiração, o recuo, a recarga e a postura anterior desaceleram em vez de desaparecer na entrada da apresentação. A cauda faz um contramovimento; o cavaleiro reage com atraso à mandíbula, com inclinação própria da cabeça. O arco considera a altura original de Feka.
- `PLAYER_CAPTURE` acrescenta oito sprites: seis poses de alcance e duas de apoio, com braços e joelhos articulados, detalhes de roupa e botas. `captureFrameAt` dirige a ordem das poses, sem reiniciar uma agitação cíclica durante a sustentação. `HypotheticalCapturedHero` gira os pixels nativos e recorta seus polígonos na garganta, sem reduzir a escala.
- A aproximação a partir de 65 ms e a sustentação usam a mesma hierarquia: cavidade, Feka, superfície do crânio, lábio e dentes. A silhueta real da cabeça oculta o herói durante a entrada; foi retirado o plano horizontal que escondia parte do sprite abruptamente em 225 ms. O desenho mantém o encaixe na mudança para `capturedHero`, em 390 ms.
- `HypotheticalCaptureAnatomy.captureNeck` prende as junções ao crânio em rotação e deforma a silhueta e as linhas das escamas durante a engolida. A pele e a garganta partem dos polígonos da pose nativa e se transformam durante a abertura da boca, evitando uma troca brusca de textura.
- `HypotheticalCaptureEffects` amostra pontos de emissão no instante de cada contato. Poeira nasce no apoio das patas, respeita margens reais e usa a paleta do piso; partículas da mandíbula não seguem a cabeça depois de emitidas. Gotas têm trajetória própria e há uma expiração curta no fim. Emissões são determinadas pelo tempo da apresentação, sem aleatoriedade de desenho nem acúmulo de entidades.
- Tiro e onda preservam a animação de derrota nativa e acrescentam impacto direcional ou fragmentos baixos. A entrada no rio é observada ao cruzar a superfície, antes da morte abaixo do mapa; o sprite fica recortado pela água e os respingos persistem entre os dois momentos. A mensagem do HUD identifica a causa e a retomada.
- Uma visão de apresentação do modelo avança apenas a idade dos efeitos já existentes e filtra seus tempos de vida. Não atualiza ataques nem colisões durante a derrota. A pausa congela o tempo; `load` remove apresentação, sons e entrada na água. O reinício nativo substitui o modelo e encerra o processamento da instância anterior.
- `WorldGame.renderPlayerTransition` é um gancho protegido com comportamento nativo por padrão. `Renderer.drawSceneIris` reutiliza a íris em scanlines para focar a boca ou a superfície do rio. Retorno de checkpoint e revelação do personagem continuam nativos.
- Alcance, fechamento da mandíbula, engolida e expiração têm sons curtos no barramento existente de efeitos; a aterrissagem das patas usa o som de passo. `cues` ordena os disparos pelo tempo de contato e o hospedeiro os toca somente ao atravessar cada marco. Pausa, silêncio, reinício e descarte cancelam as vozes. Movimento reduzido evita a aproximação de câmera e as oscilações decorativas, reduz as emissões e mantém a leitura da captura.

## Autoria e limites

`scripts/render_hypothetical_chase_defeat.ts` compõe quadros dirigidos usando os pintores reais e o Canvas nativo. A prévia tem 308 quadros a 30 fps: captura no chão, contato próximo ao peito, captura no salto e as três outras causas. O vídeo não tem áudio. As pranchas e os quadros junto aos limites de 225 e 390 ms foram inspecionados visualmente durante a autoria; `capture-contact.png` reúne as três posições iniciais em quatro momentos da ação.

Isso não é uma partida e não comprova a integração em execução, dificuldade ou desempenho. Os sons não foram ouvidos em sessão de jogo. Conforme `AGENTS.md`, não foram executados testes, typecheck, scripts de validação ou revisão de navegador. A publicação usa somente o build Vite de produção e o fluxo de deploy autorizado.
