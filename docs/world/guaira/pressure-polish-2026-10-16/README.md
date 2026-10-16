# Guaíra — tubulação, desvio e pressão

Rodada de 16/10/2026, posterior a `hydraulics-polish-2026-10-16`.
Implementação nas fases nativas; esta página apresenta capturas e vídeos dessas fases.

## Mudanças

- Construção de tubos compartilhada entre Pátio e Câmara: bronze, visores,
  abraçadeiras e curvas com a mesma espessura de nove pixels. A Câmara mantém
  sua paleta de oficina e reserva o ciano intenso para a água perigosa.
- Reflexos percorrem uma rota inteira, com distância contínua nas curvas,
  em vez de reiniciar em cada segmento. Rotas são compiladas uma vez.
- No Pátio, as descidas passam ao lado das hastes e entram na alimentação
  enterrada junto às bases. O solo oculta as conexões inferiores. A posição
  e o deslocamento dos elevadores continuam sob autoridade do motor nativo.
- O cursor do seletor acompanha os 400 ms do aviso existente. Letra e água
  continuam mostrando `supplied`, sem antecipar a saída pedida em `selected`.
- Na Câmara, a abertura de qualquer trecho da tampa desvia a água para o
  retorno. Corrigido o desnível visual de seis pixels entre tubo e água do
  retorno. A grade é desenhada por cima do fluxo. O tubo da grelha fica seco.
- Os dois cenários usam `objects.time`: pausa, morte, revelação de retorno e
  interrupção por impacto não deixam a água correr com a simulação parada.
- Corrigido o sinal de atenção no instante de subida em que a altura ainda é
  zero. Nenhuma mudança nos tempos de pressão ou no retângulo de dano.

## Verificação

- 893 testes de Guaíra aprovados, sem falhas. Seis testes novos cobrem a
  continuidade nas curvas, o desvio real, a grade do retorno, a transição de
  pressão e o congelamento pelo relógio nativo.
- `npm run build` aprovado, incluindo validações e os dois projetos TypeScript.
- 56 enquadramentos gerais e seis poses de comparação. Pintura determinística,
  sem mutação de estado; animação decorativa congelada em movimento reduzido.
- Quatro percursos já existentes: Travessia, Pátio, Respiros e Subida, sem dano.
- Três percursos adicionais de alívio, por entradas nativas a 60 Hz:

| Percurso | Atualizações | Abertura | Resultado |
| --- | ---: | --- | --- |
| Manutenção | 504 | atualização 295 | concluído, capacete intacto |
| Intervalo seco | 364 | tampa intacta | concluído, capacete intacto |
| Abertura durante descarga | 648 | atualização 419; jato de 107 px | perigo removido, concluído sem dano |

Os índices de abertura no relatório começam em zero. Os vídeos de percurso
registram uma imagem a cada quatro atualizações, a 15 fps; não interpolam física
nem alteram relógio, câmera ou posição do personagem.

- Oito fases verificadas no navegador isolado: teclado, estabilidade da janela,
  pausa e retorno ao mapa. Respiros e Câmara pausados durante descarga completa.
- 844 × 390 sem rolagem horizontal na entrada da fase. A página de comparação
  é verificada separadamente em 1440, 390 e 320 px, incluindo imagens e vídeos.
- Sem acesso ao progresso do perfil do usuário. Não é medição em aparelho físico.

Relatórios: `detail-verification.json`, `scenery-verification.json`,
`browser-verification.json`, `review-verification.json`.

## Reprodução

```text
node --import tsx scripts/prove_guaira_pressure.ts <detalhes> <modulo-canvas> docs/world/guaira/pressure-polish-2026-10-16/baseline-source
node --import tsx scripts/prove_guaira_scenery.ts <cenarios> <modulo-canvas> --tour --replay
node scripts/verify_guaira_level_finish.cjs
```

O verificador de navegador lê `PLAYWRIGHT_MODULE`, `GUAIRA_OUTPUT` e,
opcionalmente, `FEKA_UI_URL`. As quatro fontes anteriores e seus hashes estão
preservados em `baseline-source/` e no relatório de detalhes. Imports dessas
cópias são resolvidos pelo script contra o projeto e as demais cópias da rodada.

Comparações usam poses de inspeção do renderizador de produção, a 320 × 180;
não são partidas vencidas. Os vídeos comparativos têm 126 quadros a 30 fps.
As versões estreitas empilham antes/depois em vez de reduzir dois jogos lado
a lado. As colunas são congeladas em imagens independentes antes da composição,
evitando a cópia adiada de um Canvas mutável.

Fontes de trabalho, logs e sequências:
`output/guaira/pressure-polish-2026-10-16/`.
