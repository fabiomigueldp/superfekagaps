# Galeria → Câmara de Alívio na visita livre

A página existente `guaira-galeria.html` agora oferece a mesma continuação opcional da oficina visitada pelo capítulo. Ao alcançar vivo o patamar de inspeção da Galeria, o controle primário vira **ALÍVIO** e o status nomeia a Câmara. A passagem exige outra ação explícita. Se a Galeria estiver pausada, **CONTINUAR** primeiro retoma a mesma sala.

Os três controles continuam sendo placas bitmap de pelo menos 44px: primário (pausa, retomada ou Alívio), **TENTAR** e **MAPA**. Tentar reconstrói a sala atual, inclusive a Câmara depois de falha no carregamento, na fábrica ou na montagem. Na Câmara, o status explica as duas rotas e a conclusão informa o estado real: **alívio aberto, grelha sem pressão** ou **alívio intacto, grelha mantém o ciclo**.

Mapa continua sendo um link nativo para `./guaira.html?at=bairro`, sem parâmetro de visita ou progresso. Cliques modificados e histórico permanecem do navegador. Recarregar, voltar ou restaurar pelo bfcache inicia outra Galeria. A Câmara não tem nova página, rota de campanha, recibo ou armazenamento.

## Donos e descarte

`GuairaInspectionRooms.ts` contém somente os metadados e as fábricas nativas antes definidos em `GuairaChapterExcursions.ts`. Este último reexporta os mesmos nomes públicos para o capítulo e mantém seu token. O owner livre não depende de Session, navegação ou mapa do capítulo. Player, fases, física, câmera, mecânicas, tempos e arte não foram modificados.

Cada troca descarta input, áudio, controles, observers e RAF anteriores antes de carregar ou construir a próxima sala. As ações têm revisões locais: callbacks guardados, pressões de ponteiro e Space iniciados antes de troca, retry, blur ou ocultação não ativam a sala nova. Retornar ao foco renova as ações para permitir um comando novo. Enter repetido é bloqueado nos botões. Um carregamento interrompido monta pausado, mesmo se o foco retornar antes da resolução; retomar continua sendo explícito.

Fábricas tardias ou reentrantes não substituem a tentativa mais recente. Uma fábrica com identidade de sala incorreta entra na recuperação da sala pedida. Som só é preservado de um runtime validado que recebeu a preferência atual; construções rejeitadas não reativam uma preferência silenciada.

## Verificação focada

```sh
node --import tsx --test tests/guaira-gallery-page.test.ts tests/guaira-gallery-continuation-native.test.ts
node --import tsx --test tests/guaira-chapter-host.test.ts tests/guaira-chapter-excursion-native.test.ts
npm run typecheck
node_modules/.bin/vite build
```

Resultado local: **31 testes do owner livre**, **60 testes existentes de compatibilidade do capítulo**, os dois projetos TypeScript e o build Vite passaram. O build gerou 140 arquivos e 40.557.472 bytes, sem executar a suíte completa.

Quatro jornadas nativas atravessam a Galeria e ambas as rotas da Câmara, cada uma por teclado e pelos handlers dos botões DOM de toque realmente instalados pela página. Usam `update(1000/60)` e os replays existentes, sem escrever posição, tiles, checkpoint, resultados ou recibos. A prova cobre a conclusão viva, retomada da Galeria pausada antes de Alívio, descarte, resultado aberto/intacto, intenção de saída pelo link nativo e restauração em outra Galeria. O harness rejeita acesso a localStorage, sessionStorage e history.

Os outros testes são de ownership e declaram quando simulam um resultado. Cobrem ações antigas, gestos segurados, pausas/interrupções, retry de carregamento/erro, fábricas erradas/tardias/reentrantes, falhas de importação/constructor/controles/toolbar/bitmap, preferências de som e bfcache repetido. DOM, canvas, áudio e transporte são fronteiras simuladas; estes resultados não são inspeção visual de navegador, teste físico de celular nem medida de FPS. A revisão visual da versão consolidada permanece na integração.
