# Barra de toque opcional de Guaíra

Implementação local e opt-in nas cinco cenas de Guaíra. Não lê nem grava campanha e não altera a física. A maquete e os outros modos conservam seus controles anteriores.

## Integração

As entradas usam `installGuairaLabControls`, e o HTML inclui `guaira-touch-controls.css`. O adaptador monta a barra depois de criar o jogo, observa sua altura, suprime somente a sobreposição de toque dessa instância do Renderer e descarta/remonta corretamente em `pagehide` / `pageshow.persisted`. Exemplo para uma travessia:

```ts
const touchControls = installGuairaLabControls(game, canvas, () => game.finished);
```

O predicado de conclusão usa `finished` nas travessias, a fase `defeated` no touro e `publicWaterOpen` no Prefeito. O adaptador acrescenta o estado jogável e a ausência de morte. `isPlaying` é consultado na própria ativação e na soltura, mesmo antes do próximo quadro de UI.

Chamar `touchControls.sync()` na reflexão de estado existente e imediatamente após Pausa/Tentar, depois de atualizar o estado real. Ao encerrar a montagem, chamar `touchControls.dispose()`. Se a entrada desmontar em `pagehide`, recriar no retorno `pageshow.persisted`; não reaproveitar uma instância descartada. O helper não cria animações, observadores nem temporizadores.

Usar `onInteract` para desbloquear áudio. Manter foco no botão durante uma ativação de teclado; o helper registra dono/captura antes do callback, de modo que um reset ou blur síncrono cancele o gesto corretamente.

O callback de visibilidade pode executar durante o construtor, após anexar a raiz. Evitar acessar a variável `touchControls` antes de sua inicialização dentro desse callback. O nó está disponível em `#guaira-touch-controls`; a referência pública `root` pode ser observada após a construção. `visible` informa o estado atual.

## Layout e arte

- Cinco botões nativos, em ordem: ←, →, ↓, X, ↑. ↓, X e ↑ incluem as legendas visíveis **Golpe**, **Correr** e **Pular**, sem depender de hover para explicar as ações menos óbvias. Os nomes acessíveis são completos em português; a sentada continua descrita como ataque para baixo no ar
- `GuairaTouchAction` reaproveita a placa de madeira de `paintLabAction`, centraliza os símbolos na escala original de 2px e pinta legendas curtas na fonte bitmap de 1px, dentro dos mesmos 44px. Setas de direção dispensam legenda. A arte não contém estado de jogo
- Cada alvo ocupa **44 × 44 CSS px**, com `flex-shrink: 0`, independentemente da escala do canvas. Cinco alvos, quatro intervalos de 8px e margens internas de 6px requerem **264px** antes de insets laterais de área segura; cabem nos 320px comuns em retrato
- Raiz fixa no rodapé, altura normal **58px** (44 + 6 + 6 + borda 2); insets de área segura podem aumentá-la. Medir a altura real, nunca deduzir a partir da resolução 320 × 180 do jogo
- O helper `fitGuairaLabCanvas` deve descontar essa altura, além do nav superior, ao definir a área do jogo; também reservar `paddingBottom` e observar a raiz via `ResizeObserver`
- Em alturas extremas, limitar a altura rolável do nav superior à altura da viewport menos a barra, para o nav não cobrir os alvos. Nenhum controle deve ser reduzido para fazer o canvas caber
- A barra aparece somente com Pointer Events e ao menos uma indicação de toque (`maxTouchPoints > 0`) ou ponteiro grosseiro (`any-pointer: coarse`). Em desktops finos fica `hidden`; sem Pointer Events preserva os controles legados
- Durante Pausa/conclusão, os botões ficam desabilitados e a altura permanece estável. `forced-colors` e canvas indisponível mostram símbolos e legendas curtas nativos dentro dos 44px; o nome completo continua acessível e não precisa ser espremido no botão

## Entrada, fontes e descarte

`Input.createActionSource(onReset?)` cria um gesto independente. `press(action)` segura uma ação real; `release()` completa o gesto e conserva seu toque curto até o próximo passo; `cancel()` descarta apenas os eventos pendentes dessa fonte. `dispose()` cancela a fonte e remove seu callback. Repetir `press()` da mesma ação não cria bordas novas. Após descarte a fonte fica inerte.

O caminho interno de ações é o mesmo dos controles do canvas. A fonte tem identificador `symbol`, separado dos identificadores numéricos de Touch. Não há `KeyboardEvent` artificial nem mutação de `Player`. Um dedo cancelado não remove tecla real, outra fonte ou toque normal já concluído. Teclado continua tendo prioridade horizontal; dois lados opostos por toque se anulam. Toques curtos de andar/correr conservam um passo; pulo e sentada conservam suas bordas normais.

`Input.reset()` limpa ações e chama os callbacks das fontes ainda vivas. A barra invalida owners, remove o estado visual e solta as capturas de ponteiro antes de retornar: um `pointermove`, `pointerup` ou `lostpointercapture` posterior do gesto anterior não reativa nada. `pointercancel`, perda de captura, blur, documento oculto, desabilitação, perda da capacidade e descarte também cancelam os gestos. Soltura global é fallback quando a captura é indisponível. Cada dedo possui sua própria fonte, inclusive dois dedos no mesmo botão.

Enter/Espaço em botões comuns continuam pertencendo ao controle nativo. Na barra, esses eventos ativam apenas a ação do botão e têm seu comportamento padrão impedido para evitar clique duplicado. Cliques de tecnologia assistiva com `detail === 0`, sem sequência de ponteiro/teclado, produzem um toque curto. Os cliques resultantes de ponteiro (`detail > 0`) são ignorados, pois sua ação já foi tratada na soltura.

Enquanto visível, a barra adquire `Input.suspendCanvasTouchControls()`. Essa suspensão é por dono, restaura ao descarte e cancela bordas legadas ativas. O canvas nunca recebe eventos iniciados na barra; não existe redisparo cruzado. **Suprimir também o desenho legado via Renderer** evita mostrar controles antigos que já não aceitam ação. A região superior de pausa do `WorldGame.pointerdown` continua independente; ela não recebe ponteiros iniciados nos botões DOM.

## Verificação e limites

`tests/guaira-touch-controls.test.ts` usa as classes reais de Input/helper e substitui somente as fronteiras DOM/eventos. Cobre capacidades, dimensões declaradas, múltiplos dedos, teclado, bordas, toques curtos de todas as ações, cancelamentos, restauração, desabilitação, resets, descarte e ativação nativa. Os testes antigos de toque permanecem aplicáveis.

`tests/guaira-touch-action-art.test.ts` verifica os retângulos reais pintados: símbolos na escala original, legendas inteiras centralizadas, separação entre símbolo e legenda, margens e ausência de pixels fora da placa. O recorte raster de revisão mede 320 × 58px, na escala nativa, e não representa uma captura de navegador ou comprovação de legibilidade num telefone.

`guaira-dom-controls.integration.test.ts` completa o replay de1.065quadros do touro através dos botões DOM, preservando os seis acertos, capacete e isolamento da campanha com Input/Player/WorldGame/Renderer reais. Também cobre ponteiro preso durante pausa/retry, reset, blur, ocultação e reconstrução repetida pelo histórico sem duplicar controles. As fronteiras DOM/captura de ponteiro continuam simuladas; isso não substitui aparelho físico.

Essas verificações são offline. A conta de largura e as asserções CSS não são uma medição de retângulos feita por um navegador real. Não houve emulação touch, DevTools nem validação em aparelho físico nesta entrega. A integração deve conferir o ramo oculto no desktop e, quando disponível, o ramo de toque e os insets num navegador/aparelho apropriado.
