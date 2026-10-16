# Guaíra — revisão dos oito percursos

[Revisão visual e partidas completas](index.html)

## Escopo e critérios

Foram percorridas as cinco etapas da jornada, sua abertura alternativa e as duas
oficinas opcionais: Travessia, Pátio, Respiros, Ossabravo, Subida, Prefeito,
Galeria e Alívio. A revisão observa quatro coisas: a próxima ação é perceptível;
o mecanismo responde de forma coerente; a exploração oferece uma variação com
retorno; a conclusão encaminha à próxima etapa.

Os percursos usam os construtores, Input, Player, colisões, mecanismos e câmera
de produção. Não há posição, relógio ou vitória escritos para produzir as
partidas. As gravações são comandos ensaiados: demonstram que essas soluções
funcionam, sem estimar quanto um jogador novo demora para descobri-las.

## Problemas encontrados e correções

- **Pátio:** o painel de orientação ocupava a região dos apoios altos. A instrução
  agora usa a segunda linha do HUD, com prioridade para o desvio, a viagem real,
  a recuperação e a próxima placa. A câmera mostra a borda central durante a
  subida de A e mantém a margem oposta na tela durante o salto final completo.
  A seleção A/B, as moedas e a escada de retorno conservam seus comportamentos.
- **Subida:** no salto completo do mirante, a chegada antiga saía por baixo da
  tela. A sacada de 48 pixels em x1072–1120, y96 recebe o salto na altura do
  mirante. O apoio é uma plataforma nativa; suas mãos-francesas se ligam ao
  terraço real. A inspeção inferior continua livre. Saltos curtos de 2, 4 e 8
  quadros recuperam pelo degrau inferior; durações de 16, 20, 24, 36 e 52 quadros
  alcançam a sacada no percurso examinado. A chegada à Casa também perdeu o
  banner que cobria o personagem e a fachada; sua informação está no HUD.
- **Respiros:** “espere a água baixar” continuava aparecendo com o piso seco.
  A indicação agora identifica a saída à frente (ou atrás, ao retornar) e lê
  o ciclo nativo: seco, carregando, subindo, cheio, recolhendo e aliviando.
  Água subindo ou recolhendo nunca é descrita como piso seco. C isolado não
  altera D. A leitura é descritiva; não promete uma janela infinita para cruzar.
- **Prefeito:** a faixa de orientação desaparecia quando o salto passava por ela.
  Agora o aviso permanece dentro do HUD de 23 pixels, como no outro chefe,
  sem pintar sobre a arena. Os três lacres, o registro e os pulsos mantêm
  suas regras e os avisos completos.
- **Continuidade:** cada conclusão principal explica a próxima etapa do percurso
  atual. A confirmação usa o resultado nativo já observado pelo host; nenhum
  texto concede conclusão. Repetições anteriores preservam o contexto salvo.
  Ossabravo encaminha visualmente à Casa da Vazão, sem mencionar uma maquete.

Travessia, Galeria e Alívio foram novamente concluídos e examinados sem novas
alterações de geometria nesta rodada. As oito partidas completas estão na revisão.

## Evidências

- **1.029 testes de Guaíra aprovados**, 18 novos nesta rodada; zero falhas.
- Build, validadores e os dois projetos TypeScript aprovados.
- [Oito percursos completos no navegador](browser-verification.json): teclado
  real do navegador, passos de simulação de 60 Hz, sem dano nas gravações.
  As duas aberturas são montadas para inspeção; as entradas seguintes usam a
  caminhada normal do mapa e a continuação Galeria → Alívio. Não se afirma uma
  partida desde a Costa dos Gaps até a chegada a Guaíra.
- As cinco conclusões principais persistem. Galeria e Alívio mantêm a mesma
  lista de conclusões. Pátio funciona como abertura em um perfil separado.
- [Pausa, renderização e layout](browser-smoke.json): teclado, pausa congelada,
  renderização sem mutação e retorno ao mapa nas oito cenas; água em pressão
  plena também congelada nos Respiros e no Alívio. Conferência em 844 × 390.
- [Dados dos percursos](native-routes.json), oito vídeos de partidas completas,
  quatro comparações antes/depois e oito painéis com dezesseis quadros.
- [Verificação final](verification.json): testes, build, hashes das fontes,
  dimensões e reprodução dos vídeos e layout da revisão em quatro larguras.

O campo `minHelmet` do relatório nativo é uma margem conservadora `y - 10`,
não o topo do sprite. O topo renderizado é `y - 4`; o relatório do navegador
mede esse topo real e confirma a separação do HUD em todas as oito partidas.

## Reprodução

As cópias em `baseline-source/` preservam o estado imediatamente anterior a esta
rodada, incluindo o trabalho das revisões anteriores. Não usam o HEAD como se
fosse a versão vista pelo jogador. Os imports que não estão nesse conjunto
continuam usando o código de produção.

Com o caminho de `@napi-rs/canvas/index.js`:

```powershell
node --import tsx scripts/prove_guaira_chapter_readability.ts output/guaira/chapter-readability-2026-10-16/proof CAMINHO_CANVAS
node --import tsx scripts/prove_guaira_chapter_readability.ts output/guaira/chapter-readability-2026-10-16/proof-before CAMINHO_CANVAS docs/world/guaira/chapter-readability-2026-10-16/baseline-source
```

`GUAIRA_SCENES=subida` permite recapturar uma cena, preservando as outras entradas
do relatório. Os quadros nativos são 320 × 180; os vídeos usam escala inteira
de 3×, nearest-neighbor, captura a 15 fps e simulação a 60 Hz.

Com Vite ativo e Playwright em `PLAYWRIGHT_MODULE`:

```powershell
node scripts/verify_guaira_chapter_readability.cjs
$env:GUAIRA_OUTPUT='output/guaira/chapter-readability-2026-10-16/browser-smoke'
node scripts/verify_guaira_level_finish.cjs
```

## Avaliação ainda necessária com jogadores

Não houve playtest externo nesta rodada. Execução correta e clareza dos quadros
não demonstram, sozinhas, diversão nem equilíbrio final da dificuldade.

| Momento | Observar sem explicar antecipadamente |
| --- | --- |
| Primeira placa da Travessia/Pátio | A pessoa relaciona sentada, água e movimento? |
| Patamar central do Pátio | Percebe que A é uma exploração reversível e B continua a jornada? |
| Respiros A/B e oficina C | Lê o ciclo por água/manômetro? Entende que C isolado não desliga D? |
| Ossabravo | Reconhece a direção da investida e a diferença entre atacar e esperar? |
| Subida | Distingue apoio móvel de apoio fixo? Identifica a chegada e a recuperação? |
| Prefeito | Compreende o novo registro por lacre e a advertência da emenda? |
| Galeria/Alívio | Encontra o retorno da exploração e reconhece que as moedas são opcionais? |

Registrar hesitações, recuos, tentativas por obstáculo, necessidade de ajuda,
rotas escolhidas e vontade de repetir. Esses dados devem orientar a próxima
calibração de ritmo e dificuldade, sem simplesmente acrescentar obstáculos.
