# Guaíra — escolhas, exploração e percursos

Rodada de 16/10/2026: revisão das oito cenas do capítulo e alterações jogáveis
em Travessia, Respiros, Galeria, Subida e Câmara de Alívio.

[Revisão de level design](../../../guaira-level-design.md)
· [Página com comparações e percursos](index.html)

## Alterações

- Travessia: dois andaimes sobre a rua, com quatro moedas opcionais. Madeira e
  apoios correspondem aos tiles reais. A câmera preserva o capacete sob o HUD
  durante os saltos altos nesse trecho.
- Respiros: dois degraus novos conduzem a uma placa nativa de sentada; o vínculo
  isola apenas o jato C. Há três moedas adicionais, tubo até a grelha, indicação
  do estado e gotas inofensivas no fechamento. D continua independente. O ponto
  seguro foi antecipado de x624 para x608, antes de subir.
- Galeria: bolso com três moedas sob uma tampa opcional de três tiles. O fundo
  fica 64 pixels abaixo da passagem; a câmera antecipa a aterrissagem. Qualquer
  abertura parcial permite retornar sem capacete. As duas tampas principais
  continuam sendo necessárias para concluir.
- Subida: degrau à direita da galeria de inspeção, em y192, ligando o piso y240
  ao terraço y144. A rota inferior tem saída por salto comum dos dois lados.
- Alívio: três moedas na subida de manutenção, contador compartilhado e rótulo
  do coletor ao lado da tampa, livre da moeda e da trajetória do salto.

As mudanças usam `WorldGame`, `Player`, `WorldObjects` e os tiles nativos. O
registro usa o vínculo já existente entre switch e jet, incluindo aviso de
reabertura, pausa e restauração. Não há um segundo motor para esses percursos.
Os PNGs e vídeos documentam a revisão; a arte do jogo é desenhada pelo código.

## Validação

- 946 testes de Guaíra aprovados. São 22 novos: 16 percursos combinando quatro
  fases, teclado/toque simulado e movimento normal/reduzido; cinco verificações
  de recuperação/aberturas parciais; uma de isolamento, tinta de perigo e gotas.
- Os replays novos conferem apoios usados, ausência de dano, conclusão, moedas,
  capacete fora do HUD, aterrissagens visíveis e independência do respiro D.
- A reabertura do registro preserva a fase de aviso. Morte restaura o registro
  no checkpoint e as tampas da Galeria, conservando moedas da tentativa;
  reiniciar a tentativa limpa a coleta.
- As rotas principais anteriores e as duas soluções do Alívio continuam passando
  na suíte. Pátio e chefes foram revisados e mantidos, sem redesenho nesta rodada.
- `npm run build` aprovado: validadores de fases, sprites e mundo, os dois
  projetos TypeScript e compilação Vite.
- Oito cenas montadas no capítulo real em Edge com perfil isolado: movimento
  pelo teclado, pausa congelada, canvas estável e retorno ao mapa. Nenhum erro
  de página. A janela de 844 × 390 não apresentou rolagem horizontal.
- A página comparativa passou em 1440, 390 e 320 pixels, sem transbordamento:
  dez imagens e cinco vídeos decodificados, reprodução verificada, divisor
  operável pelo teclado e links respondendo. `review-verification.json`
  registra o resultado. Os 14 pares de hashes conferem com as capturas e a
  referência preservada, conforme `source-verification.json`.

`browser-verification.json` registra a conferência do capítulo.
`detail-verification.json` registra as comparações e os cinco percursos abaixo.

| Percurso | Atualizações gravadas | Conclusão na atualização | Moedas | Dano |
| --- | ---: | ---: | ---: | --- |
| Travessia com andaimes | 1.206 | 1.143 | 16 | Não |
| Respiros com isolamento C | 1.150 | 1.130 | 5 | Não |
| Galeria com bolso opcional | 825 | 817 | 3 | Não |
| Subida pela galeria | 1.244 | 1.217 | 3 | Não |
| Alívio pela manutenção | 504 | 487 | 3 | Não |

Simulação a 60 Hz; vídeos a 15 fps, ampliados de 320 × 180 para 960 × 540
por vizinho mais próximo. Os percursos são comandados apenas por entradas
nativas: não há ajustes manuais de personagem, câmera, relógio ou conclusão
durante a execução. As comparações estáticas, separadamente identificadas,
usam poses preparadas equivalentes para tornar a alteração visível.

`baseline-source/` preserva os 14 arquivos anteriores à rodada, incluindo o
trabalho ainda não commitado. A referência não é o `HEAD`. Os hashes no relatório
permitem conferir as duas versões. Cada replay começa com uma nova tentativa,
sem herdar o estado das poses comparativas. A renderização é conferida como
somente leitura em todas as capturas.

Não houve playtest externo nem medição em aparelho físico. Os testes validam
execução, leitura técnica e recuperação; não comprovam diversão ou uma nota de
qualidade. As durações ensaiadas não estimam o tempo de descoberta do jogador.

## Reprodução

```powershell
node --import tsx scripts/prove_guaira_level_design.ts output/guaira/level-design-2026-10-16 CAMINHO_PARA_CANVAS_MODULE docs/world/guaira/level-design-2026-10-16/baseline-source
```

O módulo é `@napi-rs/canvas`. Os comandos dos novos percursos estão em
`tests/helpers/guairaLevelDesignReplays.json`. O Alívio reaproveita
`tests/helpers/guairaReliefReplay.json`, agora coletando as três moedas.
Logs dos testes, build e captura estão em `output/guaira/level-design-2026-10-16/`.
