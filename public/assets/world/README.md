# Assets de Super Feka Gaps World

Assets originais produzidos na grade nativa e exportados pelo renderizador do projeto.

- `sprites.png` e `sprites.json`: 260 entradas com coordenadas e paleta. Incluem Joãozão, Calabrezzo e sua variante gelada, Bielzão, inimigos, barris, selos, bocais e canhões. Fontes editáveis: `src/adventure/WorldAssets.ts` e `WorldMachineAssets.ts`.
- `mechanisms.png` e `mechanisms.json`: 720 quadros de dez ciclos completos, exportados da simulação e do renderizador. Incluem jatos, canhões, elevador, teleférico, esteira com acionador, suporte e gelo reforçado. A galeria permite pausar, escolher o instante e inspecionar dano, apoios e alvos sólidos.
- `fundo-1.png` a `fundo-6.png`: amostras nativas de 320 × 180. O jogo compõe três planos de paralaxe por região, com variações por fase; estes PNGs são exportações para revisão. Fonte: `src/adventure/WorldBackdrop.ts`.
- Cenografia autorada: `src/adventure/WorldScenery.ts`, com peças compartilhadas de `WorldPainting.ts`. Contêineres empilhados, tanques, guindastes, estações, câmaras frias, faróis, pontes, arcos naturais, jardins e casas. As posições estão nas fases, e os topos dos contêineres e tanques são validados contra o terreno.
- `WorldTerrain.ts`, `WorldMechanisms.ts` e `WorldStageArt.ts`: materiais de terreno, máquinas, arenas e miniaturas do mapa, todos desenhados na mesma grade.
- `WorldTransportArt.ts`: ferragens, guias, pistões, carros de polias, correias, molas e travessas. O desenho das partes móveis acompanha a posição ou a distância real percorrida.
- `audio/`: dez prévias WAV dos seis temas de mundo, mapa e três chefes. Fonte e composição em tempo real: `src/adventure/WorldAudio.ts`.
- Falas gravadas de João continuam em `public/assets/audio/vo/joaozao`. Não foram sintetizadas novas falas inteligíveis em sua voz.
- Diálogos novos usam vocalizações de síntese com timbre e cadência por personagem; texto permanece a fonte da fala.

Reexportação: `scripts/verify_world.cjs` para arte, `scripts/verify_world_machines.cjs` para ciclos dos mecanismos e `scripts/export_world_audio.cjs` para música. Usam Playwright com o Vite aberto; `PLAYWRIGHT_PATH`, `CHROME_PATH` e `GAME_URL` podem apontar para ferramentas já instaladas.

O runtime usa os geradores originais em cache, evitando divergência entre um PNG editado à mão e a animação utilizada no jogo. As exportações preservam a fonte de autoria no repositório.

Panoramas dos 24 percursos: `docs/world/capturas/percursos/`, exportados por `scripts/export_world_routes.cjs`.

A galeria `docs/world/capturas/` permite selecionar estados dos inimigos e chefes, comparar a variante de Calabrezzo e pausar a animação sem deformar as proporções dos quadros.
