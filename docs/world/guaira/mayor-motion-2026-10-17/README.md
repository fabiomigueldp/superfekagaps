# Prefeito da Vazão — peso, movimento e sinais hidráulicos

Continuação da [ofensiva de 17/10](../mayor-offensive-2026-10-17/README.md), no mesmo encontro nativo usado pela campanha. Não há física alternativa nesta revisão.

## Problemas observados

- A investida parava na velocidade máxima. A pose de frenagem vinha depois da parada física.
- A água perigosa era desenhada atrás do ator e ficava parcialmente escondida pelas botas e pelo carimbo.
- O corte de pressão suprimia as ondas, mas ainda deixava suas setas no chão.
- A sombra usava apenas a posição horizontal e podia aparecer sobre a passarela durante uma passagem por baixo dela.
- O bocal do jato alto fechava no próprio quadro de lançamento, pois seu aviso já havia terminado.

## Mudanças

A velocidade de cruzeiro permanece em 5 px/quadro na segunda fase e 5,8 na terceira. A desaceleração começa antes do destino, limitada ao corredor anunciado. O passo final tem no máximo 0,25 px; o volume de água continua ativo até terminar a travessia. O descanso de 20 quadros e o aviso completo antes da reversão permanecem.

As oito passadas acompanham a distância real. O corpo se inclina para segurar a frenagem; joelhos, faixa, chave e carimbo assentam antes do próximo ataque. Os saltos agora têm seis posições dos pés, com extensão dos dois joelhos na aproximação do chão. Aterrissagem, arranque, passos, frenagem e impacto têm respostas distintas, calculadas pelo relógio da luta.

A crista usa os mesmos contornos de colisão antes e depois do desenho do chefe. A faixa frontal foi reduzida após inspeção das poses para deixar as pernas legíveis. Essa camada não amplia o perigo. Partículas decorativas usam cores quentes; nenhum novo efeito ciano aparece fora da água perigosa da investida.

As setas de ondas obedecem ao corte, à abertura fresca e ao cancelamento do ataque. A marca da carimbada permanece quando seu impacto ainda ocorrerá. O bocal acompanha a idade do jato: abertura completa na saída e fechamento durante os oito quadros seguintes. A sombra escolhe apenas apoios que estão abaixo dos pés.

## Conferência

[Resultados e hashes](verification.json), [capturas nativas](native-verification.json) e [16 poses](motion-poses.json).

Os 15 testes novos verificam desaceleração em ambos os sentidos e fases, manutenção da velocidade de cruzeiro, perigo durante a frenagem, limite do corredor, verdade dos avisos, água visível sobre o ator sem ampliar o contato, sombra sob a passarela, solas acima do plano dos pés durante o salto, passos e obturadores. Os testes existentes cobrem a margem de esquiva de ±4 quadros, pausas, repetição, derrota, registros, elevador, janela de ataque e cinco estratégias completas.

As rotas foram regravadas somente com entradas do jogador. Nenhuma gravação escreve posição, vida, estado do chefe, relógio ou registros. Os vídeos publicados mostram chão, passarela e corte; a verificação também inclui espera da descarga e recuperação de uma oportunidade perdida. A rota de derrota continua perdendo o capacete e morrendo pelo contato normal.

Limites: rotas ensaiadas não comprovam a diversão ou a dificuldade de primeira partida. Toque e gamepad são simulados; o custo medido de atualização e desenho não representa uma promessa de FPS em aparelhos físicos. O chão pode sair do enquadramento no ápice de um salto alto; os testes mantêm o capacete e os perigos próximos à ação visíveis.

## Reprodução

- `scripts/record_guaira_mayor_offensive.ts`: entradas e eventos. `GUAIRA_MAYOR_ROUTE` aceita `upper`, `ground`, `wait`, `retry`, `interrupt`, `failure`; `GUAIRA_MAYOR_OUTPUT` define a pasta de saída.
- `scripts/prove_guaira_mayor_motion.ts OUTPUT_DIR CANVAS_MODULE`: atlas das 16 poses do renderizador de produção.
- `scripts/prove_guaira_mayor_offensive.ts OUTPUT_DIR CANVAS_MODULE`: capturas de percursos completos. `GUAIRA_MAYOR_CAPTURE` limita as rotas.
- `scripts/verify_guaira_mayor_rework.cjs`: teclado e botões de toque no navegador, pausa, repetição e leitura dos vídeos. Usar `GUAIRA_MAYOR_OFFENSIVE=1`, `GUAIRA_MAYOR_VIDEO_COUNT=3` e esta página como `GUAIRA_MAYOR_REVIEW_PATH`.
- `scripts/verify_guaira_chapter_readability.cjs`: campanha normal com progresso conquistado e gamepad simulado.

As capturas preservam a simulação de 60 Hz e exportam vídeo a 30 fps com escala inteira por vizinho mais próximo. Os vídeos não incluem áudio.
