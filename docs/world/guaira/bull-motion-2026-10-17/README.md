# Ossabravo — peso, movimento e apoios no curral

Revisão de 17/10/2026. [Jogar](http://localhost:3000/guaira-lab.html) · [Partidas e animações](index.html) · [Rodada anterior: os dois arcos](../bull-arcs-2026-10-17/README.md).

## Problema observado

A investida passava diretamente do repouso para 5 pixels por passo. Parava de uma vez na extremidade e o desenho espelhava o corpo assim que a direção do retorno era definida. O ciclo das patas dependia do relógio, e a poeira acompanhava o corpo. Essas transições enfraqueciam o peso da corrida e a leitura da virada.

## Movimento e decisões de combate

A corrida agora tem aceleração e desaceleração físicas, calculadas pela distância entre origem e destino. Um percurso completo de 240 pixels continua durando 48 passos, mas começa e termina com deslocamento de aproximadamente 0,48 pixel e atinge 5,71 pixels por passo no meio. A rampa dura até seis passos e se adapta a percursos menores. A colisão varre o deslocamento real de cada passo.

O destino e a direção permanecem fixos depois do aviso. A frenagem ainda é perigosa: as costelas só abrem na parada, seguida dos mesmos 20 passos de apoio e 52 de recuperação. O retorno conserva seus 42 passos de preparação e sua própria arrancada. Seis acertos vencem; saúde e duração das aberturas não foram aumentadas.

As duas rotas completas da revisão dos arcos continuam vencendo sem dano, com os mesmos comandos e os mesmos momentos de acerto. Isso preserva as respostas por salto alto e por travessia sob o ápice, enquanto a corrida deixa de ser uniforme. A prova de salto curto tardio ainda perde o capacete no passo 474. Os arcos de 64/44 e 80/56 pixels e os intervalos entre lançamentos não foram alterados nesta rodada.

## Animação e cenário

- A passada acompanha a distância percorrida, com seis poses interpoladas em coordenadas inteiras. O arranque comprime o corpo; a desaceleração estende os apoios.
- A virada usa seis poses de sete passos: apoio na direção antiga, recolhimento, crânio frontal, troca dos apoios, orientação nova e impulso. A direção de colisão continua comprometida com o retorno durante todo o aviso.
- O crânio frontal recebeu desenho próprio, chifres com contorno claro, olhos, mandíbula e encaixe no pescoço. A largura do tronco foi mantida para conservar a leitura do corpo perigoso.
- Os contatos dos cascos geram registros fixos no mundo. A poeira permanece no piso, atrás da corrida, e expira em 16 passos. Um contato separado representa o deslizamento da frenagem. Há no máximo seis registros ativos.
- Pausa congela a animação e as partículas. Movimento reduzido omite poeira e articulação decorativa, mantendo os avisos e as posições reais do combate. Reiniciar ou acertar o chefe limpa os contatos antigos.

## Evidências

| Captura | Duração | Resultado |
| --- | --- | --- |
| `jump.mp4` | 1.274 passos / 21,23 s | Salto alto, retorno e vitória sem dano |
| `ground.mp4` | 1.294 passos / 21,57 s | Travessias por baixo, salto e golpe descendente, sem dano |
| `failure.mp4` | 500 passos / 8,33 s | Perda real do capacete no passo 474 |

`pivot-strip.png` mostra seis poses da virada. `combat-atlas.png` reúne 16 quadros das partidas. As capturas usam entradas nativas, sem edição de posição, vida, câmera ou relógio de ataque. A simulação avança a 60 Hz; as gravações exportam um quadro a cada dois passos, a 30 fps, sem áudio.

- 3.645 testes aprovados, zero falhas, um caso opcional de atlas ignorado. Os 13 novos casos verificam aceleração, frenagem, colisão dentro da faixa anunciada, duração e abertura, virada, contatos no chão, pausa e atualização acumulada.
- Build, TypeScript e validadores aprovados.
- Oito execuções no navegador: duas vitórias, recuperação de uma abertura perdida e erro com dano, em teclado e toque simulado. Dez provas de pausa conservaram imagem e estado.
- Campanha normal: nove execuções, oito cenas, ambos os chefes, retorno ao mapa e persistência de progresso com gamepad simulado.
- [Resultados](verification.json), [capturas](native-verification.json), [navegador](browser-verification.json), [campanha](campaign-verification.json) e [página de revisão](review-verification.json).

Os ensaios comprovam caminhos executáveis e integração; não medem descoberta ou diversão na primeira partida. Toque e gamepad foram simulados em navegador de desktop, sem teste em hardware físico.
