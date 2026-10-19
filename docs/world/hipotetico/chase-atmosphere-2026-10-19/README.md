# Perseguição — ambiente e rotina do cais

19.10.2026. Alterações de arte nos quatro setores da perseguição do Flávio Hipotético.

## Implementação

- `HypotheticalChaseDressing.ts`: guindastes e embarcações distantes, placas de comércio, calhas, varal, carrinhos, cordas, acabamentos de fachada, motores, bielas, respiros e bandeiras. A projeção de cada camada acompanha a margem correspondente. O vapor usa quatro partículas analíticas por respiro, sem acumular entidades.
- `HypotheticalChaseLife.ts`: `chaseWindAt` e `chaseWorkAt` fornecem vento e gestos com fases ligadas à posição/identidade de cada elemento, independentes da câmera e sem consumir aleatoriedade do combate.
- `HypotheticalChaseLifeArt.ts`: articulação dos trabalhadores, carga acompanhando a postura, ferramenta elevada até a válvula, pequenos gestos com objetos, venezianas escalonadas, aves com movimentos antes do alerta e remos ligados ao apoio do casco. A fuga mantém os tempos e a oclusão pelas portas existentes.
- `HypotheticalChaseArt.ts` e `HypotheticalScenery.ts`: madeira, aço e ferragens nos elementos rígidos; integração dos detalhes, palmeiras e porto ao desenho nativo. Colisões, duração da corrida, ataques e pontos de retomada não foram alterados.

## Material de arte

O script `scripts/render_hypothetical_chase_atmosphere.ts` compõe quatro enquadramentos, com 180 ticks de rotina antes de alertas escalonados. Usa o cenário, o terreno e os objetos nativos, sem simular a partida ou automatizar navegador. O vídeo possui 24 segundos, 30 fps e não tem áudio. A câmera e os avisos são dirigidos; o registro de autoria está em `art-study.json`.

As pranchas apresentam vistas gerais e detalhes em 4×. As capturas foram utilizadas para ajustar apoios, ferragens, braços, calhas e hierarquia de cores. A composição deixa a borda jogável clara e mantém o fundo em tons menos contrastantes.

## Publicação

Seguindo `AGENTS.md`, a publicação usa exclusivamente o build Vite de produção. Não foram executados testes, typecheck, scripts de validação ou revisão no navegador. As pranchas e o vídeo são material de autoria, não evidência de conclusão da fase ou de desempenho em partida.
