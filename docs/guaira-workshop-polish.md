# Oficina de Guaíra: profundidade e água

A Galeria e a Câmara usam reentrâncias discretas de alvenaria, nichos de ferramentas de manutenção e uma janela de irrigação com espessura. As bordas verticais encontram o piso existente; sua sombra recuada não usa o acabamento claro reservado aos apoios reais. Terreno, rachaduras, tampas removidas, câmera, Feka e mecanismos conservam a autoridade nativa. Não há textura ou prop com colisão nova.

Durante a descarga, a água da Câmara contém oito correntes internas contínuas que se deslocam para cima pelo relógio de WorldObjects. A base ciano segue opaca em cada pixel perigoso. O topo acompanha a altura real; as correntes não acrescentam espuma, partículas ou área fora da coluna. O mostrador, o aviso e as gotas inofensivas do desligamento permanecem iguais. Movimento reduzido congela somente as correntes decorativas; pausa e ocultação congelam o relógio nativo.

GuairaReliefFlow usa a paleta existente e coordenadas de mundo. A câmera não muda a fase da textura. A altura máxima desta grelha exige no máximo 138 retângulos no helper, apenas enquanto existe água perigosa; isso é um limite de operações, não uma medida de FPS ou memória do navegador. Não há timer, RAF, dependência ou asset adicional.

## Verificação

A comparação visual usa nove quadros nativos com os mesmos inputs, ator e câmera para a alvenaria, e uma sequência nativa para o fluxo. São provas offline de renderização; não representam teste físico de celular ou audição.

Os testes de guaira-gallery-art, guaira-relief-art e guaira-relief-flow cobrem fronteiras dos apoios, remoção parcial da tampa, cobertura exata do perigo, pressão/desligamento, recorte e restauração de Canvas. O teste do fluxo chama o painter integrado de produção, verifica o ciclo completo de 252 quadros e conserva o hash do raster não líquido da base aaf1734. Ele também confere deslocamento ascendente, translação da câmera, determinismo e congelamento em movimento reduzido/pausa/aba oculta.

Estas mudanças de apresentação não alteram dano, física, duração dos ciclos, soluções válidas, checkpoints ou estado da campanha.
