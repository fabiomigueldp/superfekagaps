# Império da Delícia — navegação no World

Esta página registra a primeira integração (v5). A rodada seguinte de
[caminhos e profundidade](../map-depth-2026-10-10/README.md) contém o modelo v6
e as instruções atuais de publicação. As capturas abaixo preservam a v5.

O mapa usa o `WorldJourneyModel` para percorrer as 12 fases e os dois santuários.
A seleção marca um destino; Feka caminha pelos acessos da ilha e só pode entrar
na fase após chegar. Retornos, reversões durante a viagem, movimento reduzido,
controle, teclado e botão de pular seguem o fluxo do mapa principal.

## Modelo e percurso

O [modelo v5](../imperio-delicia-v5.blend) mantém a câmera, as proporções, os
materiais e os bairros da v4. Acrescenta uma promenade nos cais, passarelas de
pedestres no aqueduto, fundações nos acessos elevados, clareiras, portais dos
santuários e áreas de chegada. A v4 permanece preservada.

Os pontos ficam no chão ou nos tabuleiros das passarelas. Os 16 caminhos e as 14
paradas são projetados pela mesma câmera que produz a imagem, incluindo as duas
junções da margem leste. Não há coordenadas estimadas para os segredos, nem
linhas retas inventadas em execução.

As curvas de navegação ficam editáveis na coleção **13 • Walkable lanes,
landings and sanctuary approaches**. As árvores deslocadas mantêm seus troncos,
copas, galhos e frutos. Os trechos de muros abertos nas passagens ficam
preservados, ocultos e identificados na cena.

## Integração

- O sprite, o ciclo de caminhada, a sombra, as placas, a fonte, os marcadores
  de caminho e o HUD são os componentes existentes do World.
- A câmera acompanha o distrito visitado. No celular, as placas vizinhas
  continuam acessíveis nas bordas, mantendo Feka em uma escala legível.
- O progresso guarda a última chegada. Uma prévia bloqueada, uma viagem em
  curso ou o encerramento da página não concede acesso ou conclusão.
- Ao concluir uma fase, Feka reaparece na parada jogada e caminha até a próxima
  liberada. Pular a viagem e entrar na fase são confirmações separadas.

## Reprodução

Na raiz do projeto, com Blender 5.2 e Pillow:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --disable-autoexec docs/world/delicia/imperio-delicia-v4.blend --python tools/delicia/integrate_map_paths.py
```

Use `-- --draft` para renderizar uma prévia em `output/` sem substituir a arte
distribuída. A entrega final reúne o `.blend`, o PNG mestre transparente em
2560 × 1600, o WebP para o jogo e `island-map-v5.json`. Para publicar a versão
atual, siga a cadeia v5 → v6 e o empacotador descritos na revisão seguinte.

Abra o [mapa integrado](http://localhost:3000/?chapter=delicia) com o servidor
local em execução. A [revisão visual](index.html) reúne capturas do jogo.

## Verificação final

759 testes aprovados e um teste opcional ignorado por ausência de
`@napi-rs/canvas`; 18 testes dos assets e caminhos finais aprovados após o
empacotamento. `npm run build` concluído, com a imagem e o JSON distribuídos
idênticos aos assets de origem.

No navegador foram conferidas as 14 chegadas, 11 transições por toque, reversão
sem salto de posição, confirmação separada de entrada, retorno de uma fase
jogada, prévia bloqueada e movimento reduzido. Nenhum erro de execução foi
registrado. O vídeo mostra uma caminhada completa acionada pela placa da fase.
