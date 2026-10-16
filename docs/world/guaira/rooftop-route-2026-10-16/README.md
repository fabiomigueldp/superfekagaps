# Guaíra · Caminho pela oficina do elevador

Esta rodada concentra as alterações jogáveis na Subida à Casa da Vazão. As
outras sete cenas passam por regressão e partidas completas no capítulo.

A sacada antes do elevador agora leva a um telhado à esquerda (544–592, y192)
e a um andaime à direita (608–672, y144). O jogador pode executar uma sequência
de saltos em vez de aguardar o ciclo da máquina. O último salto usa corrida até
o terraço existente em y144; a altura comum mantém a chegada na tela. Quatro
moedas indicam a exploração, sem virar requisito para a conclusão.

O desenho reaproveita as tábuas, ferragens, cores e oficina do cenário. Pilares
e mãos-francesas terminam na construção e na sacada. As bordas claras continuam
reservadas às superfícies da colisão. Ferramentas e tecido dão uso e movimento
ao andaime sem cobrir as trajetórias. O tecido segue o relógio e a brisa nativos;
pausa e movimento reduzido respeitam as preferências existentes.

São tiles de plataforma nativos. Nenhum controle, salto, gravidade, alcance,
transporte, período dos veículos ou regra de checkpoint foi alterado. O caminho
pelas três máquinas continua funcionando sem corrida. Um salto curto da oficina
volta pelo poço seco, degrau e sacada, conservando as moedas da tentativa.

## Verificação

- **1.080 testes de Guaíra aprovados**, com 51 casos novos. Incluem quatro
  percursos de teclado/toque simulado × movimento normal/reduzido; 36 variações
  de impulso/duração do salto; 60 momentos do ciclo de dez segundos; nove quedas
  e retornos; câmera, pausa, checkpoint e contagem de moedas.
- Percurso novo: 910 atualizações, conclusão na 907, 12 moedas, sem dano.
  Usa o canal, oficina, salto com corrida e galeria inferior. São nove moedas
  até o terraço, incluindo as quatro novas, e três na inspeção superior.
- Percurso pelas máquinas: 1.339 atualizações, conclusão na 1.315, uma moeda,
  sem dano, sem corrida ou sentada. A gravação anterior foi preservada.
- Câmera da rota nova: limite conservador do capacete de 26 px, pés até 168 px
  na tela de 180 px; maior deslocamento vertical de 7,47 px por atualização.
  A gravação antiga mantém seu ajuste máximo de 9,3 px no primeiro salto.
- Build, validação de níveis, assets do jogador, mundo e ambos os projetos
  TypeScript aprovados.
- Oito cenas concluídas em Edge com eventos de teclado e simulação conduzida
  a 60 Hz. A abertura principal e o Pátio foram montados para inspeção; os
  acessos seguintes usaram a caminhada normal no mapa e a continuação opcional.
  Cinco etapas persistiram. As oficinas mantiveram os recibos principais.
  Não se afirma uma viagem completa desde a Costa no início de uma campanha.

As capturas vêm do Canvas de produção. Comparação da sacada no mesmo instante,
com a mesma entrada desde o começo. Vídeos a 15 quadros/s, ampliados por vizinho
mais próximo. Sem escrita em posição, câmera, relógio, moedas ou conclusão.
O ensaio de morte no teste usa `Player.die('fall')` como estímulo explícito;
as nove recuperações de salto usam somente comandos e a física nativa.

Não houve teste em dispositivo físico nem sessão com jogadores externos. A
execução desses percursos não mede diversão ou descoberta. O próximo playtest
deve observar se o jogador percebe a escolha na sacada, entende a corrida,
consegue retornar após errar e prefere repetir a rota alta ou os veículos.

## Reprodução

```powershell
node --import tsx --test tests/guaira-rooftop-routes.test.ts
$guairaTests = @(rg --files tests -g 'guaira-*.test.ts')
node --import tsx --test @guairaTests
npm run build
node --import tsx scripts/prove_guaira_rooftop_routes.ts OUTPUT CAMINHO_CANVAS docs/world/guaira/rooftop-route-2026-10-16/baseline-source
$env:GUAIRA_ASCENT_ROUTE = 'roof'
$env:PLAYWRIGHT_MODULE = 'CAMINHO_PLAYWRIGHT'
$env:GUAIRA_OUTPUT = 'output/guaira/rooftop-route-2026-10-16/browser'
node scripts/verify_guaira_chapter_readability.cjs
```

`native-verification.json` registra os percursos e hashes das duas fontes
alteradas. `browser-verification.json` contém as oito conclusões. A pasta
`baseline-source` preserva as fontes imediatamente anteriores à rodada,
incluindo o trabalho já existente no checkout.
