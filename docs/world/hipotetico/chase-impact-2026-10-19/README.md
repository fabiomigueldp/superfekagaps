# Perseguição — animação, contato e ruptura

19.10.2026. Rodada focada no cavaleiro, no dinossauro e na destruição da perseguição.

## Mudanças

- `HypotheticalChasePerformance.ts`: preparação pela distância até o limiar de ruptura; contato, resposta atrasada do cavaleiro/cauda e retomada pelo mesmo relógio do cenário. O enquadramento recua até 18 pixels e retorna suavemente. Cada tipo de estrutura tem uma ordem de falha própria.
- `HypotheticalMotion.ts`: postura de estado separada da resposta estrutural, evitando capturar e reaplicar o mesmo impulso ao trocar de ataque. Compressão do corpo, sela e âncora do fuzil permanecem ligadas. Na perseguição, a postura de tiro não encurta mais a passada dos pés.
- `HypotheticalArt.ts`: rotação da cabeça e mandíbula articulada na corrida, resposta do tecido e novos efeitos nos contatos dos pés.
- `HypotheticalChaseDetails.ts`: apoios e escoras se soltam em tempos diferentes; vigas recebem impulso por material; carga, painel e placa possuem seus próprios contatos. Fragmentos assentam na margem. Tempos de contato de geometria fixa são reutilizados.
- `HypotheticalChaseArt.ts` / `HypotheticalChaseImpactArt.ts`: cabos continuam ligados à polia até a soltura, escoras deixam de desaparecer instantaneamente, ruptura da tubulação com descarga finita no canal, lascas, pequenas faíscas e poeira localizada. As peças continuam atrás do dinossauro no plano estrutural.
- `HypotheticalModel.ts`, `HypotheticalAudio.ts`, `HypotheticalGame.ts`: sons específicos de passos, madeira, metal e cabo; contatos de carga/painel/placa usam a mesma geometria da animação. Tremor horizontal de 90 ms respeita as preferências existentes. Movimento reduzido desativa o ajuste de enquadramento.

O percurso, os pontos de retomada, a velocidade da perseguição, a programação dos ataques e a geometria de colisão não foram alterados. A origem dos disparos acompanha a nova resposta corporal do cavaleiro. As novas peças decorativas não causam dano. O enquadramento mudou de forma limitada durante contatos estruturais.

## Autoria e publicação

`scripts/render_hypothetical_chase_impacts.ts` compõe quatro trechos e um estudo isolado de passada/disparo. São posições e tempos dirigidos, com os renderizadores reais; não há simulação de partida, navegador ou assertions. O vídeo possui 390 quadros a 30 fps (13 segundos), sem áudio. Pranchas foram usadas para revisar postura, materiais, apoios e o enquadramento. `art-study.json` registra as posições dos momentos selecionados.

Conforme `AGENTS.md`, a publicação usa o build Vite de produção, sem testes, typecheck, scripts de validação ou revisão de navegador. A revisão das pranchas não comprova a dificuldade, o desempenho ou a conclusão da fase em uma partida; os novos sons também não foram avaliados em sessão jogada.
