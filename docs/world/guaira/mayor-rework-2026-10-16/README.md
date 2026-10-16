# Prefeito da Vazão — reformulação do encontro

O chefe deixou de repetir uma descarga fixa no balcão. Agora escolhe um alvo,
anuncia a aterrissagem, salta até ele e retorna para uma abertura de contra-ataque.
Os três lacres preservam o objetivo do capítulo, mas alteram o padrão de combate.

## Regras jogáveis

- Primeira carimbada: 60 ticks de aviso, 32 de salto e 24 de impacto.
- Último lacre: uma segunda marca independente, com 42 ticks de aviso e 28 de salto.
- A marca permanece imóvel desde o início do aviso. Aterrissagens respeitam chão,
  apoio esquerdo e balcão. A plataforma desce durante a preparação.
- Ondas nos dois sentidos após o último impacto das etapas 2 e 3. A velocidade
  passa de 2,2 para 2,6 pixels por tick. Não aparecem no primeiro lacre.
- Dois registros nativos ligados entre si acionam a mesma plataforma. Só uma
  ativação após o último impacto vale para abrir as costas e desviar as ondas.
- Retorno em 42 ticks. Recuperação de 210 ticks, incluindo o tempo que ainda
  faltar para a plataforma chegar. Não há extensão da janela ao reabrir o registro.
- A contrapressão existente mantém 60 ticks de aviso e 24 de descarga na emenda.
  Um acerto válido por cima tem precedência e encerra os perigos do ciclo.
- Água com contornos em degraus: desenho e colisão consomem a mesma geometria.
  O retângulo de aviso contém todo o impacto; seus cantos vazios não ferem.
- O jogador mantém física, aceleração, salto, sentada, capacete e reinício nativos.
  A vitória continua sendo reconhecida pelo anfitrião do capítulo.

## Percursos

`guairaMayorReplay.json`: registro inferior no primeiro lacre, plataforma real,
registro superior nos seguintes, salto de contra-ataque durante a descarga.

`guairaMayorJumpPulseReplay.json`: alternativa que se afasta da emenda e espera
a descarga completa. O nome do arquivo é mantido por compatibilidade histórica.

`guairaMayorGroundReplay.json`: atrai uma carimbada no chão, salta sobre a onda,
aciona novamente o registro inferior, sobe na plataforma e conclui os três lacres.

`guairaMayorFailureReplay.json`: para dentro da emenda, perde o capacete e morre
na próxima carimbada. Não ganha resultado nem avanço no capítulo.

Os percursos só enviam comandos comuns. Preparações pontuais de posição em
testes de contato são identificadas como fixtures e não aparecem nos vídeos.

## Evidência visual e reprodução

`baseline-source/` contém os quatro arquivos de produção anteriores à rodada;
`baseline-mayor-replay.json` é seu percurso original. O script reconstrói apenas
essas importações, sem substituir a física ou o jogador.

```powershell
node --import tsx scripts/prove_guaira_mayor_rework.ts OUTPUT CAMINHO_DO_MODULO_CANVAS
node --import tsx scripts/prove_guaira_mayor_rework.ts OUTPUT_ANTES CAMINHO_DO_MODULO_CANVAS docs/world/guaira/mayor-rework-2026-10-16/baseline-source
$guairaTests = @(rg --files tests -g 'guaira-*.test.ts')
node --import tsx --test @guairaTests
npm run build
```

O módulo de captura é `@napi-rs/canvas`, fora das dependências de produção.
`scripts/verify_guaira_chapter_readability.cjs` usa Playwright/Edge para concluir
as oito cenas com controles de teclado; só a primeira entrada de inspeção é
montada diretamente. As seguintes usam as entradas e caminhadas comuns do mapa.

Todos os vídeos usam simulação e captura de 60 Hz, sem áudio. A pausa congela
as poses; movimento reduzido mantém sinais essenciais e elimina efeitos cosméticos.
Os testes de áudio verificam disparo e cancelamento, não constituem avaliação de mixagem.

Não houve playtest externo. Os tempos dos percursos são de execução ensaiada;
não medem a duração, a diversão ou a dificuldade de uma primeira partida.
