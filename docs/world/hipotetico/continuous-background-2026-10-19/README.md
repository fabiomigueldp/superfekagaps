# Atividades contínuas no fundo

Rodada de 19/10/2026. Implementada no encontro nativo `/?encounter=hipotetico`.

## O problema

Depois de deslocar e romper a pilha original, o diretor anterior alternava principalmente busca, observação e patrulha. A variedade de ataques se esgotava. A espera por uma pilha fora do enquadramento também podia suspender a progressão da animação.

## Nova sequência

O fundo agora alterna seis ações repetíveis sobre escombros e estruturas de serviço: investida com a cabeça, pisada simples ou dupla, remexer com três contatos, caudada, duas rajadas e rugido. Cada rua tem uma ordem inicial diferente; a ordem muda nas voltas seguintes e exclui as duas últimas ações quando há alvos compatíveis no enquadramento.

Cada ação passa por deslocamento, orientação, antecipação, contato e recuperação. O dinossauro vira antes de caminhar e se orienta para o alvo ao chegar. O golpe fica comprometido com o local escolhido; a câmera pode redirecionar a caminhada seguinte, sem fazer o ataque perseguir Feka no fundo.

| Momento | Duração nativa |
| --- | --- |
| Deslocamento | 48–144 passos, conforme distância |
| Virada, quando necessária | 36 passos |
| Ação | 104–142 passos, conforme tipo |
| Recuperação | 32–48 passos, conforme variante |

O jogo atualiza a 60 passos por segundo. Os tiros saem em grupos, com uma pausa entre eles. As pisadas alternam uma batida mais pesada e uma combinação dupla. Os rugidos têm som próprio e provocam pequenas reações nos elementos próximos.

Não há estado de conclusão nesse ciclo. Ele continua enquanto a cena permanece ativa na rua atual. A apresentação original da próxima rua continua assumindo o controle quando Feka avança.

## Continuidade visual e limites de recursos

- Três pontos por rua: madeira, pedras e uma estrutura metálica ancorada. As marcas de desgaste saturam; os objetos não reaparecem intactos.
- O disparo parte da ponta da arma articulada, acompanhando orientação, recuo, corpo e direção do cavaleiro. Impactos, estojos, luz e aquecimento usam o relógio da atividade.
- Os materiais respondem com lascas, fragmentos e faíscas próprios. Os contatos têm altura e posição no cenário.
- Aves só são espantadas de novo após pousarem. Os voos seguintes partem do beiral onde retornaram.
- Moradores que alcançaram o abrigo permanecem lá. A demolição original não é reconstruída para repetir a animação.
- As ações aguardadas fora do enquadramento dão lugar a uma atividade local; a intervenção inicial é retomada quando o alvo volta a ser visível.
- Projéteis, impactos e estojos têm vida limitada e limites de quantidade. A troca de rua encerra os efeitos da anterior.
- A preferência de movimento reduzido mantém a encenação, reduzindo lampejos, partículas e oscilações decorativas. O áudio usa o barramento de efeitos já existente.

## Autoria e publicação

O vídeo de 60 segundos usa os modelos e o renderizador de produção em quatro composições simultâneas. Nos primeiros 40 segundos as posições são mantidas; nos 20 finais a câmera percorre o mesmo pátio com posições dirigidas. Não é uma partida gravada, um teste automatizado ou uma medição de dificuldade. O áudio sintetizado do jogo não está incluído no vídeo.

`art-study.json` registra ações, tempos, posições e quantidades de efeitos durante esse estudo. O material foi produzido com:

```powershell
node --import tsx scripts/render_hypothetical_aftermath.ts .tmp/aftermath-continuous-final C:/Users/fabio/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas/index.js --routines
```

Conforme `AGENTS.md`, a publicação executa somente o build de produção, sem suíte de testes, typecheck ou revisão de navegador.

O primeiro build excedeu o orçamento de 53 MB por 9.642 bytes. O atlas nativo `public/assets/world/mechanisms.png` foi recomprimido sem perdas com `scripts/repack_png_lossless.mjs`: 635.125 → 209.156 bytes. Apenas o fluxo zlib foi reempacotado; scanlines, filtros, cores, transparência e os demais chunks permanecem iguais. O limite do projeto foi mantido.
