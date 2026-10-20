# Perseguição: expansão e direção

A perseguição passa de 4.480 para 8.192 px. A saída fica em 8.064; a distância
desde o nascimento de Feka equivale a aproximadamente 38 segundos à velocidade
nativa de corrida, antes de considerar desvios, aceleração e erros. Essa é uma
estimativa geométrica, não uma medição de partida.

## Percurso implementado

| Região | Intervalo | Decisão principal |
| --- | --- | --- |
| Cais | 0–1.120 | Aprender os vãos e a primeira carga que freia o perseguidor. |
| Carga | 1.120–2.240 | Superar o batedor e escolher entre andaimes e pista durante a investida. |
| Pórtico | 2.240–3.520 | O RPG rompe a estrutura; usar os decks que assentam ou a passarela de manutenção. |
| Comportas | 3.520–4.928 | Perceber a pressão, superar a crista de água e alcançar a rota elevada. |
| Passarelas | 4.928–6.560 | Cruzar o carrinho e manter a corrida durante o salto comprometido do dinossauro. |
| Portaria | 6.560–8.064 | Batedor com salto curto, último contrapeso, investida e combinação final de rajadas. |

Os checkpoints ficam em 2.240, 4.640 e 6.560. Eles recriam o trecho seguinte,
marcam os eventos anteriores como consumidos e removem patrulhas já ultrapassadas.
A etapa seguinte do arsenal e o duelo continuam no mesmo encontro.

## Construção e integração

- `HypotheticalLayout`: dados únicos de regiões, ataques, vãos, plataformas,
  inimigos, contrapesos e eventos.
- `HypotheticalChaseSetpieces`: relógio da preparação do RPG, disparo pelo
  encaixe real da arma, ignição após a saída do cano, impacto, decks,
  reservatório e salto. A pintura consulta o estado; não dispara eventos.
- `HypotheticalEncounter.update`: acrescenta cada deck à colisão nativa quando
  ele assenta. O mesmo apoio participa da cobertura dos projéteis. A passagem
  do perseguidor remove colisão e inicia o destroço correspondente.
- `HypotheticalChaseSetpieceArt`: juntas, parafusos, correntes, grampos, vigas,
  captação de água, mostrador de pressão, tampa, foguete, fumaça e crista. As
  vigas desprendidas descem até a água; correntes acompanham suas âncoras.
- `HypotheticalChasePatrol`: batedores com preparação e investida comprometida;
  a última variante acrescenta um salto curto. O operador solta um carrinho com
  rodas, gravidade, colisão nativa e possibilidade de quebrá-lo por cima.
- `WorldFoe.contactPoint` / `WorldGame`: dano, ressalto e partículas usam o
  objeto realmente atingido. Acertar o carrinho não desloca Feka até a sacada
  do operador. O padrão dos demais inimigos permanece na própria entidade.
- `HypotheticalMotion`: compressão, soltura das pernas, cauda, cabeça, cavaleiro
  e recuperação do salto compartilham a trajetória do corpo.
- `HypotheticalChaseCounterplay.escapeCredit`: a carga acertada conserva uma
  vantagem de distância e a reduz progressivamente, em vez de recuperá-la
  imediatamente.
- `HypotheticalGame`: câmera antecipa decisões com transição suave; preserva
  o avanço funcional com movimento reduzido. O HUD acompanha as seis regiões.
- `HypotheticalChaseLife`: fachadas, trabalhadores, aves, barcos e indústria
  cobrem toda a nova extensão, com alturas e materiais das respectivas regiões.

## Orquestração

RPG, água, salto e encontros com patrulhas reservam intervalos do percurso.
Neles, novas rajadas e investidas não são iniciadas. Projéteis que já estavam
em voo conservam sua trajetória. Ataques atrasados expiram quando Feka passa
de sua janela de entrada.

A primeira rajada baixa depois do pórtico foi antecipada para o vão seguinte:
o projeto permite combinar a esquiva com a travessia. O salto do dinossauro
tem 30 ticks de preparação, 44 de voo e 24 de recuperação; a aterrissagem
é comprometida e não persegue a posição de Feka durante o voo.

O reservatório avisa antes de romper e só libera a água após a aproximação
do dinossauro. A colisão fica dentro da crista clara de 30 px; a espuma e a
esteira atrás dela são efeitos. O fluxo termina no canal aberto.

Não foram acrescentados “PISE”, “ALTO”, “BAIXO” ou instruções flutuantes.
Postura, direção da arma, cabo, válvula, borda dos apoios e água comunicam as
ações. As descrições detalhadas continuam no status acessível fora da tela.

## Arte e limites da revisão

`scripts/render_hypothetical_chase_expansion.ts` compõe 425 quadros dirigidos
com os renderizadores nativos. Ele não atualiza a simulação, não reproduz
entradas, não executa asserções e não abre uma sessão de navegador. As pranchas
foram inspecionadas durante a autoria; a segunda passagem refinou os apoios,
a continuidade das peças que caem e a soltura da preparação do salto.

- `chase-expansion.png`: 16 composições dos eventos, rotas e inimigos.
- `rider-details.png`: apoio da arma e saída do foguete, ampliados em pixels inteiros.
- `water.png`: composição da crista e rota elevada.
- `chase-expansion.mp4`: 425 quadros / 30 fps, composição dirigida sem áudio.
- `art-study.json`: metadados que identificam a natureza dessas imagens.

Por instrução do projeto, não foram executados testes, typecheck, scripts de
validação ou revisão de navegador. Inspeção de código, pranchas de arte e build
de produção são evidências distintas. O equilíbrio de dificuldade e a resposta
de jogadores não podem ser comprovados por essas pranchas.
