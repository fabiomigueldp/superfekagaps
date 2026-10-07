# Recompensas fora dos arcos: auditoria de 7 de outubro de 2026

Base: `32a14d672ef38f59125dc6dfb66a215e96e3cdd4`.

## Moeda depois da chegada

As 24 fases sem arena colocavam uma moeda em `exit.x + 16`, com o mesmo
Y das moedas de aproximação. Ela se sobrepunha ao pano da bandeira e ficava
para além do gatilho de conclusão. Em uma aproximação normal andando ou
correndo, `WorldGame.update` concluía a fase antes de Feka tocá-la. Isso não
é uma alegação de impossibilidade de saltar por cima do gatilho e retornar.

A correção muda somente essas 24 coordenadas X. A moeda passa para o chão
seguro antes da chegada, com pelo menos 22 px entre recompensas. Os deslocamentos
mais longos preservam pares de moedas já existentes nessa mesma aproximação.
A lista explícita é `campaignFinishRewards.ts`; não há redistribuição automática.
IDs, ordem, contagem, selos, equipamento, saídas, checkpoints, terreno e os
212 pontos dos 25 guias de salto permanecem iguais.

## Evidência e limites

- `campaign-finish-rewards.test.ts`: 24 fases × andando/correndo, usando o
  `WorldGame.update` real, jogador, objetos e inimigos. Os dados históricos
  concluem a fase sem a moeda; os novos coletam a moeda enquanto o estado ainda
  é `playing` e depois concluem. Em 6-4, o jogador vem da passarela real anterior
  e desce 32 px, sem nascer em cima da recompensa.
- A fixture histórica de moedas continua intacta. A regressão dos arcos permite
  somente os 24 IDs revisados e exige preservar todas as outras posições.
- `prove_campaign_rewards.ts`: raster offline do Canvas de produção em 1-1 e
  6-4, antes/depois. Câmera e jogador posicionados para inspeção, sem alegar teste
  em navegador, dispositivo ou travessia integral das fases.
- A busca local também encontrou coleta com pouso, sem contato com inimigos,
  barris ou jatos, para as 330 moedas fora dos arcos. Essa busca não inclui
  conclusão de fase e, portanto, não detectava sozinha o problema de ordem do
  gatilho. Recompensas junto a jatos continuam temporizadas; não foram tornadas
  triviais. A trilha deliberada da praia em 1-1 também foi preservada.

Validação focada: 139 testes passaram (chegada, arcos, praia inicial,
contabilização de tentativas e compatibilidade de campanha); ambos os projetos
TypeScript passaram. O gate completo e a publicação ficam com a integração.
