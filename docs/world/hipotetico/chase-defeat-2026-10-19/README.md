# Perseguição — captura de Feka e leitura das derrotas

19.10.2026. Escopo: derrota durante a perseguição do Flávio Hipotético.

## Diagnóstico do código

O corpo do perseguidor e os projéteis entravam pelo mesmo retorno `hurt` de `HypotheticalModel.contact`. `WorldGame.hurt` aplicava a proteção nativa e depois `Player.die('hit')`; todos os contatos fatais usavam o mesmo salto de derrota. A morte por queda ocorria apenas abaixo do mapa, e `Renderer.drawPlayer` deixava de desenhar Feka sem uma entrada na água. Durante a derrota, o modelo do chefe parava de avançar, congelando destroços e reações em andamento.

A caixa de contato do dinossauro fica no corpo; o personagem pode estar junto ao peito, principalmente depois de perder o capacete. Levar Feka diretamente à boca criaria um salto de posição. A nova sequência parte da posição real, faz um arco curto de impacto e só então passa a desenhar o personagem preso à mandíbula.

## Implementação

- `HypotheticalModel` associa a causa aos mesmos retângulos de colisão que já eram usados. A ordem permanece a mesma, inclusive no último trecho de uma bala antes de atingir uma cobertura. O hospedeiro inicia a apresentação somente depois de a regra nativa declarar a morte. Capacete, invencibilidade, dimensões de colisão e velocidade da perseguição mantêm suas regras.
- `HypotheticalChaseDefeat` usa exclusivamente o tempo nativo de morte. Captura: 65 ms de impacto, contato com a boca em 390 ms, levantamento até 720 ms, engolida de 810 a 1130 ms, fechamento de tela de 1410 a 1710 ms e reinício automático em 1910 ms. O comando R existente continua disponível.
- O movimento dos pés é capturado na postura inicial e assenta na freada. Cabeça, mandíbula, cauda, braços, rédeas e cavaleiro têm movimentos de acompanhamento. O arco também considera a altura original de Feka.
- `PLAYER_CAPTURE` acrescenta quatro sprites com braços e joelhos alternados à construção nativa do herói. `HypotheticalCapturedHero` gira seus pixels na mesma grade do jogo. A inserção na boca ocorre entre o fundo da cavidade e o lábio/dentes; a garganta oculta progressivamente o personagem inteiro, sem gore ou redução de escala.
- Tiro e onda preservam a animação de derrota nativa e acrescentam impacto direcional ou fragmentos baixos. A entrada no rio é observada ao cruzar a superfície, antes da morte abaixo do mapa; o sprite fica recortado pela água e os respingos persistem entre os dois momentos. A mensagem do HUD identifica a causa e a retomada.
- Uma visão de apresentação do modelo avança apenas a idade dos efeitos já existentes e filtra seus tempos de vida. Não atualiza ataques nem colisões durante a derrota. A pausa congela o tempo; `load` remove apresentação, sons e entrada na água. O reinício nativo substitui o modelo e encerra o processamento da instância anterior.
- `WorldGame.renderPlayerTransition` é um gancho protegido com comportamento nativo por padrão. `Renderer.drawSceneIris` reutiliza a íris em scanlines para focar a boca ou a superfície do rio. Retorno de checkpoint e revelação do personagem continuam nativos.
- Três sons curtos usam o barramento existente de efeitos, com cancelamento em pausa, silêncio, reinício e descarte. A opção de movimento reduzido evita a aproximação de câmera e as oscilações decorativas, mantendo a leitura da captura.

## Autoria e limites

`scripts/render_hypothetical_chase_defeat.ts` compõe quadros dirigidos usando os pintores reais e o Canvas nativo. A prévia tem 308 quadros a 30 fps: captura no chão, contato próximo ao peito, captura no salto e as três outras causas. O vídeo não tem áudio. As pranchas e a transferência do personagem para a mandíbula foram inspecionadas visualmente durante a autoria.

Isso não é uma partida e não comprova a integração em execução, dificuldade ou desempenho. Os sons não foram ouvidos em sessão de jogo. Conforme `AGENTS.md`, não foram executados testes, typecheck, scripts de validação ou revisão de navegador. A publicação usa somente o build Vite de produção e o fluxo de deploy autorizado.
