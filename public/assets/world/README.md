# Assets de Super Feka Gaps World

Assets originais produzidos na grade nativa e exportados pelo renderizador do projeto.

- `sprites.png` e `sprites.json`: 140 entradas com coordenadas e paleta. Incluem Calabrezzo, Bielzão, inimigos, barris, selos e variações de animação. Fonte editável: `src/adventure/WorldAssets.ts`.
- `fundo-1.png` a `fundo-6.png`: amostras nativas de 320 × 180. O jogo compõe camadas com paralaxe; estes PNGs são exportações para revisão. Fonte: `src/adventure/WorldArt.ts`.
- Cenografia autorada: `src/adventure/WorldScenery.ts`, com contêineres, tanques, guindastes, estações, câmaras frias, faróis, pontes e arcos. As posições estão nas fases.
- `audio/`: dez prévias WAV dos seis temas de mundo, mapa e três chefes. Fonte e composição em tempo real: `src/adventure/WorldAudio.ts`.
- Falas gravadas de João continuam em `public/assets/audio/vo/joaozao`. Não foram sintetizadas novas falas inteligíveis em sua voz.
- Diálogos novos usam vocalizações de síntese com timbre e cadência por personagem; texto permanece a fonte da fala.

Reexportação: `scripts/verify_world.cjs` para arte e `scripts/export_world_audio.cjs` para música. Ambos usam Playwright com o Vite aberto; `PLAYWRIGHT_PATH`, `CHROME_PATH` e `GAME_URL` podem apontar para ferramentas já instaladas.

O runtime usa os geradores originais em cache, evitando divergência entre um PNG editado à mão e a animação utilizada no jogo. As exportações preservam a fonte de autoria no repositório.

Panoramas dos 24 percursos: `docs/world/capturas/percursos/`, exportados por `scripts/export_world_routes.cjs`.
