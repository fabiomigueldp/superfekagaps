# Guaíra: contexto curto entre trechos

O capítulo aproveita o status existente e o resumo da maquete para ligar dois
resultados ao motivo da viagem:

- Depois da derrota real de Ossabravo: “Ossabravo descansou. A água ainda falta no
  bairro. Suba à Casa da Vazão.”
- Depois da abertura real do ramal público: “Ramal público aberto. Os moradores
  têm água na bica outra vez. Os gaps continuam.”

As frases têm 72 e 81 caracteres. Substituem o resumo genérico nesses pontos,
sem acrescentar botão, janela, espera, animação ou fala bloqueante. A Subida
continua sendo a dona da revelação do cano particular e do ramal fechado.
Concluir Ossabravo não antecipa esse desvio nem promete que a água foi consertada.

`GuairaChapterStory` deriva o contexto dos recibos aceitos da sessão do host.
Não lê a URL, a posição, dicas nativas ou checkpoints. O contexto do curral só
existe enquanto a Subida for o próximo trecho; depois que o ramal público foi
aberto, repetir Ossabravo não volta a descrever o bairro como seco. O resultado
final continua legível na maquete, incluindo visitas opcionais e progresso
restaurado. Não há novo campo de save, marca de “visto” ou identificador de cena.

O status da tentativa só mostra a frase quando o adapter nativo está realmente
concluído e Feka está vivo. Pausa, morte, carregamento e erro preservam suas
mensagens prioritárias. TENTAR esconde a vitória da tentativa recém-aberta sem
apagar o resultado que já foi conquistado. CONTINUAR e MAPA mantêm a navegação
explícita; CHEGAR e movimento reduzido continuam afetando somente a caminhada.

## Verificação

- 109 testes focados: story, presentation, chapter host e map view
- As duas aberturas, recibos restaurados, seleção/repetição, abandono, recibos
  incorretos ou de outra sessão e leitura repetida sem alteração de progresso
- Replays nativos reais de Ossabravo e Prefeito através do host; pausa, retomada,
  TENTAR, MAPA, recibos idempotentes e descarte sem novos frames/listeners
- `npm run typecheck` e `git diff --check`

O utilitário `tools/guaira/render_chapter_story.mts` usa os replays e painters de
produção com `@napi-rs/canvas` opcional. Ele verifica cada quadro: a primeira
frase surge no mesmo quadro que o resultado nativo, 1065 para Ossabravo e 982
para Prefeito, tanto normal quanto com movimento reduzido. Produz composições
390/960 px com a frase exata e o renderer real da cena e maquete; cada linha de
texto cabe na largura medida e o render não modifica a simulação.

Essas composições são provas offline de Canvas com diagramação de texto
equivalente, explicitamente rotuladas. Não são capturas de navegador nem provam
as quebras reais do DOM/CSS. O navegador de nuvem recusou o endereço local
`http://127.0.0.1:4175/guaira-capitulo.html` com `net::ERR_BLOCKED_BY_CLIENT`.
A verificação responsiva final deve ocorrer no preview autorizado, sem contornar
a restrição local. Não há alegação de teste humano de dificuldade ou de FPS.
