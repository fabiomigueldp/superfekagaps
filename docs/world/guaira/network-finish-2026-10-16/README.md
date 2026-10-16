# Guaíra — a rede de água pelas fases

Rodada de 16/10/2026 nas tubulações e nos circuitos do Pátio, dos Respiros,
da Câmara de Alívio, da Subida e do Prefeito. As mudanças estão nos
renderizadores usados pelo capítulo nativo e pelos laboratórios.

## Alterações

- Pátio: coletor com tampa, parafusos, base sobre a margem e visor animado;
  cavaletes sustentam a tubulação elevada até o piso. As abraçadeiras
  preservam os três pixels de água e a leitura das saídas A/B.
- Respiros: apoios prendem a alimentação à estação, sem cobrir seus visores.
  Reflexos discretos percorrem os canais dos arrozais atrás das plantas
  e das bordas de terra.
- Câmara de Alívio: coletor com ferragens, vedação e apoio na saída;
  retorno com moldura, fixações e fundo rebaixado. A água faz a última
  curva para baixo, atrás da grelha, somente quando a tampa está aberta.
- Subida: a alimentação da reserva usa as mesmas peças de tubulação das
  oficinas, com fluxo contínuo da cisterna até o reservatório. O ramal
  público conserva a comporta fechada e o visor seco. A galeria de
  inspeção ganhou apoios assentados no piso.
- Prefeito: tubulação com curvas, juntas e apoios comuns às outras fases.
  A reserva particular recebe água desde o início; a saída do bairro
  só recebe fluxo quando o encontro realmente libera a rede. As ondas
  do canal partem da bica. A liberação preserva a fase do fluxo a montante.

A Subida e o Prefeito passaram a usar o relógio da simulação para a água
do cenário. A animação respeita pausa, impacto e reaparecimento. Depois
de concluir a Subida, um avanço ambiente mantém a água em movimento sem
avançar os mecanismos nem o tempo da partida encerrada. Movimento reduzido
mantém a decoração estática.

Arte procedural na grade nativa de 320 × 180, ampliada por vizinho mais
próximo. Os PNGs e vídeos desta pasta documentam a revisão; as fases
desenham os elementos diretamente pelo código de produção. Física,
colisões e entradas continuam usando os mecanismos nativos.

## Revisão e validação

A referência em `baseline-source/` foi preservada imediatamente antes
desta rodada, incluindo o trabalho anterior ainda não commitado. As poses
comparam câmera, personagem, tempo e estado equivalentes. A referência
não é o `HEAD`. `detail-verification.json` registra os parâmetros,
hashes anteriores e atuais, pureza de renderização e resultados dos percursos.

- 924 testes de Guaíra aprovados. Dez testes novos cobrem visores livres,
  apoios, continuidade pelas curvas, circuitos secos/abertos, relógios
  hidráulicos, movimento reduzido e conclusão da Subida.
- `npm run build` aprovado, incluindo os validadores de fases, jogador
  e mundo, os dois projetos TypeScript e o Vite.
- Doze poses, com 24 imagens antes/depois, e cinco sequências de 4,2 segundos
  a 30 fps. As comparações usam enquadramentos e estados preparados para
  inspeção; os percursos abaixo usam entradas nativas independentes.
- Seis percursos completos, com capacete intacto: Pátio (893 atualizações),
  Respiros (877), Alívio pela abertura (504), Alívio pelo intervalo (364),
  Subida (1.339) e Prefeito (1.112). Não há alteração manual de posição,
  câmera ou relógio durante os percursos. Simulação a 60 Hz, captura a 15 fps.
- As oito fases passaram pela conferência de teclado, pausa, estabilidade
  do canvas e retorno ao mapa, sem erros de navegador. Os detalhes estão
  em `browser-verification.json`. A janela de 844 × 390 não teve transbordamento.
- A página comparativa passou pela conferência em 1440, 390 e 320 pixels:
  24 imagens decodificadas, 16 vídeos distintos reproduzidos, divisor acessível
  pelo teclado e ausência de rolagem horizontal ou erros. Resultado em
  `review-verification.json`.
- Os hashes dos dez arquivos registrados confirmam que as capturas usam
  o código final e que suas referências anteriores foram preservadas.
  Os links locais também foram verificados em `source-verification.json`.

Os testes e o build estão registrados em
`output/guaira/network-finish-2026-10-16/`. A conferência no Edge usa
perfil isolado e não representa uma medição em aparelho físico.

## Reprodução

```powershell
node --import tsx scripts/prove_guaira_network_finish.ts output/guaira/network-finish-2026-10-16 CAMINHO_PARA_CANVAS_MODULE docs/world/guaira/network-finish-2026-10-16/baseline-source
```

O módulo de canvas é `@napi-rs/canvas`. O script usa o renderizador de
produção e replays de `tests/helpers/`, restaura os renderizadores nativos
antes de executar os percursos e verifica conclusão e ausência de dano.
