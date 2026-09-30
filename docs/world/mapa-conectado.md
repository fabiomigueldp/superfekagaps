# Costa e Porto no mesmo mapa

Este recorte liga a Costa dos Gaps ao Porto do Bielzão em um espaço contínuo. As duas ilhas conservam posições fixas; a câmera muda de enquadramento, mas a geografia não muda com a seleção. No celular, a travessia acompanha o barco por uma janela próxima. O panorama mostra o conjunto.

## Seleção, chegada e entrada

Selecionar uma placa escolhe o destino. Feka percorre as rotas do terreno, chega ao cais, embarca e atravessa antes de seguir até a fase escolhida. O botão Entrar e o atalho de teclado só iniciam a fase depois da chegada. Cliques repetidos numa placa não iniciam a fase por acidente. Uma fase bloqueada pode ser examinada sem mover o personagem para ela.

As setas horizontais percorrem fases; as verticais escolhem a primeira fase da região anterior ou seguinte, como os controles de região. O arquipélago mantém as seis regiões acessíveis. Apenas Costa ↔ Porto recebe transporte físico neste recorte; as demais regiões conservam a troca de mapa existente.

A viagem pode ser pulada. Movimento reduzido conclui o deslocamento sem animação e ainda exige uma ação explícita para entrar. Um novo destino durante o percurso segue ou reverte o trecho atual sem mudar a posição do personagem instantaneamente.

## Progresso e recuperação

O formato do save permanece na versão 1. `save.selected` registra a última fase alcançada; um destino em trânsito fica apenas na sessão. Recarregar ou sair ao menu durante a viagem retorna a uma chegada confirmada. A conclusão de uma fase libera a seguinte imediatamente, mas conserva a fase jogada como posição física até a nova viagem começar. Saves antigos que apontam para uma fase bloqueada são tratados como uma prévia, com o personagem numa fase disponível.

Os IDs, regras de desbloqueio, 30 fases, 72 selos, replay, galeria, editor e modo clássico permanecem os mesmos. Se os assets de transporte falharem, a seleção de região continua disponível com aviso e entrada explícita, sem desenhar uma travessia inventada.

## Estrutura e verificação

`WorldJourneyModel` separa seleção, deslocamento, chegada e entrada. `WorldJourneyNetwork` valida o contrato dos cais e do barco antes de construir o grafo. `WorldAtlasModel` mantém a projeção e os enquadramentos; `WorldAtlasArt` desenha o mar, as duas ilhas e as camadas do barco. `WorldMapHud` usa os glifos bitmap e a paleta originais do jogo em controles semânticos. `WorldMapView` coordena esses módulos no relógio já pertencente ao jogo, sem outro loop de animação.

Imagens e metadados são ativados em pares. Uma resposta tardia não troca a geometria de um trecho em andamento. Câmera, pontos de fase e caminhos existentes foram preservados nos assets; o novo acesso ao cais usa uma camada separada. O personagem é desenhado entre as camadas traseira e dianteira do barco, com o mesmo ponto de apoio medido no Blender.

Os testes cobrem mudanças de destino, bloqueios, carregamento tardio ou incompleto, dimensões dos assets, retorno de fase, cancelamento, teclado, movimento reduzido e foco. A revisão no navegador complementa esses testes para composição, leitura e contato visual com o terreno. Auditorias de autoria e reprodução estão em [coast-port-journey-art.md](diorama/coast-port-journey-art.md).

Não há promessa de FPS sem medição no navegador. Esta implementação não modifica nem implanta o jogo hospedado no Oracle.
