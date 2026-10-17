# Ossabravo — altura, ritmo e leitura do curral

Revisão de 17/10/2026. [Jogar](http://localhost:3000/guaira-lab.html) · [Capturas completas](index.html).

## Problema observado

Os dois projéteis saíam juntos, separados por 22 pixels, viajando a 3 pixels por passo e quicando em sincronia. A altura de 32 pixels permitia tratar a dupla como um obstáculo só. A animação da quicada também usava um relógio comum, sem diferenciar a reação de cada costela.

Medi o movimento do Player original, desde o chão do curral, com entradas de teclado. Saltos com 1, 4, 9 e 18 passos de botão segurado subiram aproximadamente 19,75, 37,5, 71 e 99,9 pixels. Esses valores orientaram os arcos; a física do Feka não foi alterada.

## Progressão do ataque

| Saúde do chefe | Alturas dos ossos | Intervalo entre lançamentos | Velocidade horizontal | Períodos das quicadas |
| --- | --- | --- | --- | --- |
| 6–5 | baixos | simultâneos | 3 px/passo | sem arco |
| 4–3 | 64 / 44 px | 16 passos (267 ms) | 3,2 px/passo | 44 / 36 passos |
| 2–1 | 80 / 56 px | 18 passos (300 ms) | 3,4 px/passo | 48 / 40 passos |

O aviso de 48 passos fixa direção, origem, velocidades, alturas e tempos. Deslocar-se depois do aviso não redireciona o ataque. O segundo osso fica visível, ainda solto e sem perigo, até sua própria pisada. As duas trajetórias desenhadas são as utilizadas pela simulação. A recuperação mantém 52 passos depois da saída do último osso; seis acertos ainda vencem.

## Decisões de gameplay e espaço

- O salto alto exige segurar o botão e ler o arco. O salto curto tardio antigo agora perde o capacete por colisão real.
- Cruzar sob os ápices é outra resposta. O atraso do segundo osso exige observar a passagem antes de subir para o contra-ataque.
- A investida de ida e volta continua compondo a última etapa. Os avisos e as oportunidades de acerto continuam usando o motor normal.
- O corredor de 312 pixels e a câmera fixa foram preservados. Chão livre e cenário atrás da cerca deixam visíveis projéteis, sombra, ponto de aterrissagem e o chefe na mesma tela. Não houve ampliação artificial de duração, saúde ou adição de plataformas que eliminariam a ameaça horizontal.

Nos ensaios com entrada nativa, a primeira dupla alta admite início do salto com variação de ±3 passos. A travessia sob os arcos finais também admite essa variação no salto posterior, conservando a vitória sem dano. Isso verifica uma margem concreta de execução; não mede a facilidade com que um jogador novo descobrirá a resposta.

## Animação e integração

Preparação e segunda pisada articulam patas, cabeça e caixa torácica. A rotação de cada osso usa sua idade individual; a sombra estreita no ápice e a poeira nasce no contato real com o chão. Rastros curtos acompanham a trajetória já percorrida. O segundo osso recebe reflexo lilás para corresponder ao seu arco no aviso.

Cada lançamento produz o evento nativo de liberação e seu som. Pausa congela os relógios, inclusive entre os dois disparos. Movimento reduzido omite rotação decorativa, rastros e poeira, conservando o perigo e seus sinais. Os últimos quadros de projéteis que saem da tela permanecem desenhados enquanto suas colisões do mesmo passo ainda podem atingir o jogador.

## Evidências

- `jump.mp4`: vitória sem dano, saltos altos, 1.274 passos / 21,23 segundos.
- `ground.mp4`: vitória sem dano, travessias por baixo e golpe descendente, 1.294 passos / 21,57 segundos.
- `failure.mp4`: 500 passos / 8,33 segundos; o salto antigo perde o capacete no passo 474.
- `combat-atlas.png`: 16 quadros da partida, incluindo os dois lançamentos e seus contatos.
- [Resultados](verification.json) e [capturas nativas](native-verification.json).

As gravações usam comandos de entrada, sem edição de posições, vida, câmera ou relógio de ataque. O escalonador das provas avança o jogo em passos de 60 Hz. Teclado, toque e gamepad de navegador são simulações de entrada; não representam testes em aparelho físico.
