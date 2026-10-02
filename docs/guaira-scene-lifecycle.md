# Ciclo de vida das cenas de Guaíra

Pré-requisito isolado para montar cenas na mesma página. Não cria sessão, migração,
registro de capítulo ou nova semântica de URL. As entradas experimentais existentes
continuam funcionando por documento; o novo host deve importar os adapters, sem
importar as entradas que instalam toolbars e iniciam loops por conta própria.

## Inventário verificado antes da alteração

Uma instância de qualquer um dos seis adapters adquire:

| Dono | Recurso | Encerramento anterior |
| --- | --- | --- |
| `WorldGame` | RAF recursivo; keydown, pointerdown no canvas, blur e visibilitychange; referência `window.worldGame` | Sem encerramento; chamadas repetidas a `start()` criavam loops adicionais |
| `Input` | keydown/keyup em captura, blur, visibilitychange e quatro listeners touch no canvas; eventual RAF aguardando o canvas; fontes de gesto e comandos pendentes | Sem encerramento |
| `Renderer` | resize; referência `window.renderer`; dois canvases internos | Sem encerramento |
| Adapter Guaíra | keydown de desbloqueio de áudio | Listener anônimo permanente |
| `WorldAudio` | Contexto próprio, três buses, osciladores/fontes/filtros/envelopes agendados, buffer de ruído, clip e promise de `play()` | Sem encerramento; falha tardia do clip podia reabrir fala |
| `WorldMapView`, se criado | Superfície/HUD, ResizeObserver, resize/motion/keydown, cargas abortáveis | Já tinha `dispose()`, mas o jogo não o chamava |
| Host/página | Controles de toque, observadores e RAF de reflexão da toolbar | Algumas limpezas próprias; não eram recursos do adapter |

Sem mapa ou controles externos, são **14 listeners por cena**: sete na janela,
dois no documento e cinco no canvas. Atlases e caches de WorldArt/Renderer são
memória da instância, sem jobs/listeners próprios; tornam-se coletáveis quando o
host solta a cena. As especificações imutáveis de arte compartilhadas pelo módulo
não são alteradas pelo descarte.

## API do host

- `game.start()` inicia um único loop; chamadas repetidas são inertes
- `game.isDisposed` informa o descarte terminal
- `game.dispose()` cancela o RAF, limpa comandos/fontes de toque, remove listeners,
  encerra recursos externos registrados, desmonta o mapa, libera importação pendente,
  descarta renderer e áudio. É síncrono e idempotente; o fechamento assíncrono do
  AudioContext é solicitado depois de desconectar as saídas, com rejeição tratada
- `game.addCleanup(cleanup)` registra um recurso do host/subclasse e devolve uma
  função de liberação idempotente. Registro após descarte executa a limpeza imediatamente
- `this.listen(target, type, handler, options)` está disponível nas subclasses;
  registra remoção e protege callbacks já selecionados contra execução tardia
- `Input`, `Renderer` e `WorldAudio` também expõem `dispose()` e `isDisposed`

O host deve descartar a cena anterior antes de montar a próxima e registrar suas
próprias fontes, controles/observadores/RAF em `addCleanup`. O host continua sendo
responsável pela validade da tentativa/geração de capítulo em callbacks de resultado.
Campos de resultado já alcançados não são apagados pelo descarte; eles deixam de
mudar porque `load`, `update`, `render`, pausa e os dois getters de avanço dos adapters
recusam trabalho após descarte. Guardas da sessão devem rejeitar resultados antigos.

O renderer/input recebem explicitamente o canvas da cena. Os construtores sem
argumento preservam o caminho legado de procurar `game-canvas`. Descartar uma
instância antiga só remove referências globais que ainda apontam para ela.

## Prova e limites

`tests/guaira-scene-lifecycle.test.ts` usa os seis adapters, Player, mecanismos,
renderizadores, Input, WorldAudio, controles e WorldMapView reais. Apenas DOM/desenho,
RAF e dispositivos de áudio são instrumentados; dispatch/remoção usam EventTarget nativo.

A prova cobre duas montagens de cada adapter; um RAF/contexto ativo; movimento real
do Player na cena nova; descarte repetido; captura de toque; blur/aba oculta; construção
interrompida (inclusive falha de matchMedia nos seis adapters); descarte durante um frame; attachment tardio de Input; listener/RAF já
capturado; callback de gesto com erro/tentativa de reativação; clip rejeitado depois de substituição/descarte; inicialização parcial de
áudio; desmontagem do mapa/observer/cargas; preservação de referências mais novas.
Após descarte, não há input, pintura, nova fonte sonora, mudança de resultado ou RAF.
O teste de armazenamento falha até se uma cena efêmera tentar ler `localStorage`.

Comandos focados:

```sh
node --import tsx --test tests/guaira-scene-lifecycle.test.ts
npm run typecheck
```

A prova não substitui jogar o capítulo montado no navegador, verificar foco real,
comportamento de áudio no dispositivo, retorno do mapa, Back/Forward ou as duas voltas
completas do futuro host. Toolbars das páginas diretas e suas navegações não foram alteradas.
