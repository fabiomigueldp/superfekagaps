# Guaíra — aqueduto e desvio de inspeção

Revisão de 17/10/2026. [Ver os percursos](index.html#altura) · [Evidências](aqueduct-verification.json).

## O problema observado

A Subida ensinava elevadores e telhados, mas encerrava a extensão no mesmo piso da portaria. Faltava uma chegada que desenvolvesse sua identidade vertical. A Galeria apresentava tampas e passagens inferiores na abertura, depois terminava com tábuas e uma patrulha. Sua exploração subterrânea não voltava a participar das decisões.

As gravações anteriores foram examinadas junto da geometria, dos contatos, da câmera e dos estados dos inimigos. O trabalho concentrou-se nesses dois percursos; as demais fases conservam suas revisões e continuam na validação da campanha.

## Subida — Escadaria do Aqueduto

O encerramento continua depois da antiga saída. Um checkpoint protege a aproximação; um degrau leva à primeira muralha, com uma couraça. Uma tábua frágil sobre o vão permite alcançar o segundo patamar, mais alto. Há espaço para aterrissar e ler o arremessador antes de enfrentar seu barril. A chegada à Casa da Vazão fica 96 pixels acima do piso da portaria.

O cenário passa de 3.648 para 4.544 pixels de largura, com oito inimigos no total. Os arcos distantes, as muralhas, a vegetação nas juntas e a casa final acompanham o terreno. Bordas jogáveis usam o contraste do restante de Guaíra; a arquitetura distante permanece recuada.

A validação inclui ficar sobre a tábua até ela romper, cair de verdade e concluir uma nova tentativa a partir do checkpoint conquistado. O arremessador conserva aviso, lançamento e recuperação; saltar sobre o barril permite a aproximação para o golpe.

## Galeria — Desvio de Inspeção

A nova sala tem dois percursos conectados. Pelo corredor superior, o jogador observa o manômetro e atravessa a descarga no intervalo seco. Pela tampa rachada, desce a uma sala sob o corredor, passa sob uma parede de contenção, enfrenta uma couraça e alcança o registro.

O registro fecha somente a grelha dessa sala. A conexão retorna pela esquerda, com cotovelos, vidro e fluxo contínuos. Degraus visíveis levam ao corredor. Depois da manutenção, também é possível voltar por cima para recolher as moedas da outra rota; essa volta foi percorrida com controles nativos.

A extensão passa de 2.432 para 3.520 pixels, com sete inimigos. A sala inferior tem teto, pilares, luminárias, drenagem e sinalização própria. A luz e a paleta distinguem o espaço de exploração das bordas sólidas e da água perigosa.

Na revisão visual, o apoio elevado antes do último arremessador escondia o chão durante o ápice do salto. A aproximação foi refeita no mesmo plano do inimigo e da aterrissagem. Um teste acompanha os três durante todo o combate, além de conferir o jogador inteiro abaixo do HUD.

## Conferência e limites

- Três percursos completos desde o início: Subida, Galeria pelo corredor e Galeria pelo túnel. Física a 60 Hz, captura a 30 fps, sem áudio.
- Quatro tempos de chegada por percurso: 12 execuções sem dano obrigatório. Os comandos conduzem o personagem; nenhum ator, relógio, vida ou resultado é alterado para concluir essas rotas.
- Nove regressões novas: ambas as apresentações de movimento, perigo real, morte e retomada, registro independente, retorno para explorar e enquadramento do último combate.
- Dez gravações existentes foram estendidas preservando os comandos anteriores ao novo trecho. As diferenças de relógio em uma entrada alternativa são tratadas pelo controle de teste que lê a pressão real.
- Teclado e toque simulado conferidos no navegador, com pausa congelando estado e imagem. Campanha normal percorrida com Gamepad API simulada, incluindo caminhada no mapa, progresso conquistado e recarregamento.

As execuções são ensaiadas. Seus tempos não estimam a duração de uma primeira partida, e testes automáticos não comprovam diversão, descoberta ou dificuldade percebida. Esses pontos continuam dependendo de partidas de pessoas que não conheçam as rotas. A inspeção visual e os testes desta rodada estão registrados no relatório vinculado acima.
