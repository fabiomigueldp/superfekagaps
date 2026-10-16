# Guaíra — reservatórios, encaixes e comportas

Rodada de 16/10/2026 concentrada nas duas comportas da Travessia, aplicada aos
renderizadores usados pelo capítulo nativo e pelo laboratório.

## Alterações

- Quatro entradas/saídas receberam assentos na alvenaria, juntas, flanges e
  parafusos. As ferragens preservam os três pixels do visor, inclusive no tubo
  inclinado que alimenta a comporta final; o fluxo mantém sua fase até a parede.
- Reservatórios com borda segmentada de pedra, recorte frontal para a água,
  marcas discretas na linha d'água e planos de argila conectados ao barranco.
- Correntes superficiais convergem para o recorte e descem até a comporta.
  A superfície fica em repouso enquanto a válvula local está fechada, mesmo
  quando a primeira válvula já abastece a entrada da comporta final.
- Guias fixas, madeira com estrias, reforço inferior e porca presa à comporta.
  O volante gira conforme a posição real da ponte; o parafuso passa pelo
  suporte fixado aos dois lados. A saída da água tem uma faixa junto à madeira.

Arte procedural inteira, na grade nativa de 320 × 180. As imagens e vídeos
desta pasta são evidências da revisão. O jogo desenha os elementos pelo código
de produção, com o relógio hidráulico nativo, inclusive em pausa, impacto,
reaparecimento e movimento reduzido.

## Revisão visual e verificações

Os arquivos em `baseline-source/` preservam a versão existente imediatamente
antes desta rodada. A comparação usa a mesma câmera, personagem, relógio e
posição dos mecanismos nas duas versões; não usa `HEAD` como referência.
Os hashes anteriores e atuais constam em `detail-verification.json`.

- 914 testes de Guaíra aprovados; cinco testes novos sobre corrente contínua,
  água restrita ao reservatório, válvulas independentes, visores desobstruídos
  e acionamento preso à comporta. Uma descontinuidade no reinício das novas
  ondulações foi identificada e corrigida durante esta revisão.
- `npm run build` aprovado: validação de fases, jogador e mundo, dois projetos
  TypeScript e compilação Vite.
- Seis poses de comparação, duas sequências de abertura de cinco segundos a
  30 fps e conferência dos quadros intermediários. Essas poses são preparadas
  para inspeção, separadamente dos percursos por controles.
- Dois percursos completos por teclado: taipas (1.048 atualizações) e
  manutenção (1.074), ambos com capacete intacto, sem alteração manual da
  posição, da câmera ou do relógio. Simulação a 60 Hz, captura a 15 fps.
- A conferência de teclado, pausa, estabilidade do canvas e retorno ao mapa
  nas oito fases consta em `browser-verification.json`.
- A página de revisão foi conferida em 1440, 390 e 320 pixels de largura:
  doze imagens decodificadas, seis vídeos distintos reproduzidos, comparação
  acessível pelo teclado e ausência de rolagem horizontal ou erros. Resultado
  em `review-verification.json`; os hashes confirmam que as capturas usam a
  versão final dos arquivos de produção.

## Reprodução

```powershell
node --import tsx scripts/prove_guaira_gate_finish.ts output/guaira/gate-finish-2026-10-16 CAMINHO_PARA_CANVAS_MODULE docs/world/guaira/gate-finish-2026-10-16/baseline-source
```

O módulo de canvas usado na captura é `@napi-rs/canvas`. O script usa o
renderizador de produção e replays nativos existentes em `tests/helpers/`.
Ele verifica pureza de pintura, determinismo, movimento reduzido, conclusão
das rotas e ausência de dano. A inspeção no Edge usa um perfil isolado; não
representa uma medição em aparelho físico.
