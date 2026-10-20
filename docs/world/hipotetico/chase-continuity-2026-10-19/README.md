# Perseguição — ligações e continuidade

19.10.2026. Continuação do polimento de movimento e destruição.

## Problemas encontrados e mudanças

- A carga acompanhava apenas parte da queda da viga; a placa ficava fixa enquanto suas amarras se alongavam. `HypotheticalChaseSuspension.ts` deriva ambos os objetos dos pontos de sustentação da viga. A soltura preserva posição, velocidade linear e angular. A trajetória seguinte usa gravidade e um giro gradual; o contato considera os cantos do palete ou da placa. Os dados de soltura das duas geometrias fixas ficam em cache.
- O cabo do guindaste e as correntes do pórtico conservam seus pontos de ligação até o corte. Depois, pendem da viga e a oscilação diminui. Textura, cintas, etiqueta, palete e rachadura acompanham a mesma rotação da carga.
- O painel da comporta usava uma fração do deslocamento da viga. Ele agora usa o deslocamento da própria peça em `chaseRuinAt`.
- A poeira de aterrissagem aparecia perto do apoio original, mesmo quando a peça havia viajado para o lado. `drawChaseLandingDust` recebe o canto real de contato da viga, carga, placa ou painel. Os sons de queda existentes leem os mesmos tempos da animação em `HypotheticalModel`.
- Um monte genérico crescia no chão e uma viga adicional aparecia depois. Ambos foram removidos; o resultado mantém as partes desprendidas, fragmentos e marcas nas juntas dos apoios.
- As patas dianteiras ficavam rígidas. `ChaseGesture` liga seu balanço à passada e seu recolhimento à preparação/impacto. `HypotheticalArt` desenha ombros, cotovelos, punhos e garras em segmentos articulados, com profundidade entre as patas.
- As rédeas agora têm folga entre a mão e o cabresto, tensionam no esforço e relaxam na retomada. A expressão se concentra na preparação e há uma breve reação dos olhos no pico do contato. A respiração ociosa deixa de sobrepor uma segunda oscilação ao corpo durante a corrida.

As mudanças das patas, rédeas e expressão são específicas da perseguição. O movimento reduzido suprime a oscilação decorativa desses elementos e reduz partículas, preservando a ação estrutural. Percurso, velocidades, ataques e colisões de combate permanecem como antes desta rodada; os destroços são decorativos.

## Autoria e limites

`scripts/render_hypothetical_chase_impacts.ts` compõe posições e tempos dirigidos usando os renderizadores reais. A prévia inclui quatro estruturas, um estudo da corrida/disparo e duas sequências isoladas de suspensão. São 510 quadros a 30 fps, 17 segundos, sem áudio. `art-study.json` registra os momentos usados; as imagens individuais também estão nesta pasta.

As pranchas foram inspecionadas e refinadas durante a autoria. Isso não é uma partida nem comprova dificuldade, desempenho ou conclusão do percurso. Os sons não foram avaliados em sessão jogada. Conforme `AGENTS.md`, o fluxo de publicação executa somente o build Vite de produção, sem testes, typecheck, scripts de validação ou revisão de navegador.
