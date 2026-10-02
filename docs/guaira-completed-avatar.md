# Apresentação de Feka após concluir uma passagem

Galeria, Câmara, Pátio e Respiros congelam a tentativa ao alcançar sua chegada real. Antes, esse congelamento também prendia o feedback do ator: uma chegada durante a fase branca de invulnerabilidade mantinha Feka branco indefinidamente; uma chegada durante a piscada podia deixar os olhos fechados.

`CompletedAvatarPresentation` conserva um tempo apenas de apresentação. Enquanto a passagem está concluída e em execução, esse tempo avança. Na pintura, uma cópia de PlayerData desconta o tempo residual de invulnerabilidade, pouso, recuperação da sentada e brilho temporário. O renderer recebe um deslocamento temporal somente para o avatar piscar normalmente. Pausa congela essa apresentação, e load/retry a reinicia.

O PlayerData real, posições, mecanismos, câmera, partículas do mundo, relógios globais, tempo da tentativa, placar, resultado e save continuam congelados. Não há chamada adicional a Player.update. Um ator morto conserva a apresentação nativa de morte. As outras salas, a campanha e chamadas comuns do renderer usam exatamente o caminho anterior; o novo argumento do painter tem padrão zero.

A Câmara tem reprodução sem estado fabricado: esperar 47 quadros e segurar Direita+Corrida produz perda do capacete no quadro 163 e chegada no 213, com 166,667 ms de proteção restante. As regressões verificam teclado/toque e movimento reduzido, 60 segundos de quadros concluídos, pausa/mute, retry e ausência de mudanças físicas. Estados condicionais de feedback nas outras três salas são fixtures explicitamente separados de suas chegadas reais. Comparações independentes de renderização padrão incluem morte, reaparecimento, movimentos, capacete e limites da piscada.

O hook protegido WorldGame.renderPlayer é apenas uma extensão de pintura. Seu padrão chama o mesmo Renderer.drawPlayer com os mesmos dados/câmera de antes. Ele não fornece autoridade para modificar simulação, colisão ou progresso.
