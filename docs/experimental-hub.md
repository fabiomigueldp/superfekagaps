# Entrada dos experimentos

O título principal mantém Começar/Continuar aventura, Galeria, Opções e Jogar o original. Uma placa nativa de 44 px, **EXPERIMENTOS**, fica abaixo do canvas, sem cobrir o título ou os personagens. A instrução do título explicita `SETAS/ENTER: MENU · TAB: EXPERIMENTOS`.

A placa abre um único `dialog` nativo com três links: Capítulo de Guaíra, Guaíra livre e Turbosuco. O capítulo é descrito como cinco resultados nesta sessão, com o aviso “Sair ou recarregar reinicia o capítulo. Sem progresso salvo entre visitas.” Nenhuma promessa de retomada entre documentos foi adicionada.

## Contratos

- `main.ts` chama `WorldGame.enableExperimentalHub` depois do último foco inicial no canvas. Somente a instância principal recebe a chamada; instâncias efêmeras recusam a instalação. Editor, clássico e laboratórios não ganham o componente.
- A classe tem uma única vida útil sob `WorldGame`. Não há RAF, armazenamento, nova mídia, nova ilha, novo save ou nova página HTML. As placas reutilizam `LabToolbarAction`, o bitmap e as cores ART existentes.
- Abrir limpa inputs e suspende controles de toque do canvas. O canvas fica `inert`; captura de teclado isola o modal dos atalhos e o `WorldGame` bloqueia explicitamente seu menu, ponteiro e atualização durante a abertura. Enter/Space nativos, Tab, Shift+Tab e Escape mantêm o contrato de controles HTML.
- Fechar, cancelar, receber o evento nativo `close`, trocar de tela ou descartar libera suspensão e `inert`. O foco volta ao acionador válido. A campanha não muda ao abrir ou cancelar. Uma falha em `showModal` também desfaz a aquisição.
- As dimensões CSS do canvas só são sobrescritas com a classe do título. Preservam o tamanho inteiro anterior se houver espaço; quando a placa exige espaço, reduzem apenas o necessário, sempre em 16:9. O backing canvas e o mapeamento normal de coordenadas não mudam. Ao sair do título, a classe some e as dimensões do Renderer voltam a valer.
- Os três links são âncoras sem interceptação de clique. Ctrl/Meta/clique do meio e histórico pertencem ao navegador. O retorno dos experimentos usa apenas `./?experiments=1`; o seletor aceita o valor exato e único, não interpreta URLs nem dados de sessão fornecidos pela query.
- Uma volta por bfcache ao título reabre o modal se a navegação partiu dele. Dentro do mesmo documento, fechar mantém a instância atual da campanha. O capítulo mantém seu contrato anterior: `pagehide` descarta, `pageshow.persisted` cria uma sessão vazia.
- Guaíra livre recebe também um link nativo para o capítulo. O cabeçalho passa para duas linhas abaixo de 421 px, mantendo os três controles em 44 px. A saída só descarta o mapa em `pagehide`, pois cliques modificados não deixam o documento.

## Verificação deste lote

Passaram 88 testes focados: `experimental-hub`, `guaira-map-ui`, `guaira-chapter-host` e `guaira-scene-lifecycle`. Incluem o `WorldGame` e `Input` reais com fronteira DOM modelada, sessão/campanha preservadas, falha de modal, fechamento tardio, bfcache, disposição, foco, navegação modificada, contextos rejeitados e geometria 320×480 / 472×303 / 640×360 / 844×390. Typecheck de runtime/ferramentas, validações de fases/assets/World e build também passaram. A checagem completa final cabe à integração.

Build limpo contra `539eb244e73b4029df6200cd89689a38510e2967`: 40.570.007 bytes em 140 arquivos, abaixo de 45.000.000. Acréscimo de 11.151 bytes no pacote; JS/CSS +11.029 bytes brutos e +2.989 bytes gzip. Mídia adicional: zero. A comparação usa outputs limpos para não contar chunks antigos.

A prova visual deste lote usa o painter real do título e das placas, com composição de geometria DOM **modelada** para antes/depois, modal e cabeçalho livre. A fonte de texto do mock caiu em uma substituição com serifa; o CSS real pede monospace. As imagens não são screenshots nem prova de CSS/foco nativos. A URL local foi bloqueada pelo navegador cloud (`ERR_BLOCKED_BY_CLIENT`); não foi tentada outra rota de navegador. O gate integrado de publicação deve verificar em navegador real o layout compacto, foco/Tab/Escape, retorno dos três destinos e histórico. Os controles novos mantêm placas bitmap em 44 px, sem redução de letras em breakpoints.
