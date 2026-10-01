# Boias decorativas das travessias marítimas

Quatro boias discretas tornam os canais Costa–Porto e Reserva–Domínio mais
legíveis no arquipélago. São objetos de cenário sem interação, texto, moedas,
estrelas ou linha de trajeto. A proposta preserva as rotas, as durações, a câmera
e os controles compactos existentes.

## Pacote aprovado

As duas variantes compartilham a paleta do barco: pintura coral ou verde suave,
faixa marfim, estrutura de ferro azul-petróleo e pequeno detalhe de latão. O
topo cônico e o topo cilíndrico distinguem as silhuetas. Os dois pequenos arcos
na água fazem parte da imagem da boia.

| Arquivo | Dimensão | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `maritime-buoy-coral.webp` | 160 × 208 | 4.690 | `339945c3d96332798de58e1f9ffabb5345340d9b154cd84d0d52a6c44cbb8689` |
| `maritime-buoy-sage.webp` | 160 × 208 | 4.332 | `2e68d803bc1a7060747b60a605f4ee2feaeca2529b39bcea1181ecde97da8de5` |
| `maritime-buoys.meta.json` | versão 1 | 1.390 | `339b693dc6392412741f29e1c1ddc0ca26a8592550e5f6c64dd01077fa26b921` |

As imagens somam **9.022 bytes**; imagens e metadados somam **10.412 bytes**.
Os WebPs instalados são cópias byte a byte da prova aprovada, sem nova renderização
ou recodificação. PNGs, folhas de inspeção, capturas e arquivos Blender ficam fora
do repositório.

O contrato mínimo em `public/assets/world/map/maritime-buoys.meta.json` declara
`version: 1`, `coordinateSystem: "atlas"`, as duas imagens em `sprites` e
exatamente quatro `instances`. Cada instância contém ID único, rota
`coast-port` ou `reserva-dominio`, variante e ponto de ancoragem no atlas. As
posições exploratórias e o resultado completo da busca de candidatos não são
dados do jogo.

Cada quadro usa `widthInMap = 1.5 / 20.6` e ancora a linha d'água no pixel
`(80.00003814697266, 165.6254117488861)`. A escala vertical segue a mesma razão
8:5 do atlas e dos barcos. A geometria da boia tem 0,66 unidade de largura e
1,155 de altura; na prova panorâmica desktop sua silhueta ocupa aproximadamente
9 × 18 pixels. Não há tamanho mínimo de tela que aumente a boia artificialmente.

## Autoria e reprodução

A prova foi construída sobre o commit
`87453281d62436bc647a8a5b443e51520999df3e` em 1 de outubro de 2026. A execução
observada usou **Blender 4.3.2**, Cycles, 16 amostras e quatro threads, em um
diretório temporário separado do jogo.

Essa execução gerou os dois PNGs e terminou com código 0. O último quadro, da
variante verde, registrou 0,13 segundo incluindo a gravação; esse número não é
uma medida do tempo total de inicialização e dos dois quadros.

O script versionado conserva a geometria, a câmera, os materiais e a iluminação
da execução aprovada. Apenas o destino de saída foi convertido em argumento:

```sh
blender -b -t 4 -P tools/diorama/render_maritime_buoys.py -- --output-dir /tmp/feka-maritime-buoys
python tools/diorama/package_maritime_buoys.py --source /tmp/feka-maritime-buoys
```

O empacotador usa Pillow com WebP `quality=90, method=6`, valida quadro, escala e
âncora contra o contrato aprovado e escreve em uma subpasta `package` do diretório
temporário. Ele preserva as quatro posições do contrato existente. Instalação e
publicação são passos separados; nenhuma delas é realizada pelo script.

A sintaxe dos dois scripts foi verificada. Uma execução do empacotador sobre os
PNGs originais, em outra pasta temporária, reproduziu byte a byte os dois WebPs e
o JSON instalados; essa verificação não repetiu a renderização nem substituiu os
arquivos aprovados.

## Verificação visual e limites

As quatro posições originais foram escolhidas ao lado dos trajetos existentes,
com deslocamento normal de 0,15 na métrica 8:5. Duas receberam o pequeno ajuste
descrito abaixo para a embarcação com 64 vistas. A busca evitou o arco baixo da Costa que exigiria ampliar
o enquadramento. Foram inspecionadas composições locais com o pintor TypeScript
real do mapa, nas dimensões 1180 × 757 e 472 × 303, mantendo a mesma câmera entre
antes e depois. No compacto, as boias ficam com poucos pixels.

A auditoria original em resolução nativa de 1920 × 1200 considerou alfa maior que 32 nas
imagens reais das ilhas, dos cais e dos barcos. Percorreu as duas direções a 60 Hz,
com os headings publicados, a transição de 120 ms e a orientação final dos
últimos 0,65 segundo: **722 poses Costa–Porto e 652 poses Reserva–Domínio**.
Nas quatro posições escolhidas, encontrou zero pixels de sobreposição com os
cascos em movimento e zero com terra ou cais.

Os retângulos completos dos quadros do barco incluem margens transparentes e se
sobrepõem às boias em algumas poses. Portanto, o resultado é uma verificação de
silhuetas renderizadas, não uma certificação de separação de retângulos inteiros
ou de colisão física 3D. A inspeção local também não substitui o QA da prévia real.

O contrato de integração é desenhar as boias depois do mar e antes do terreno e
dos veículos. Elas não participam de seleção, progressão, navegação ou cálculo
dos limites da câmera. Ausência ou falha desses assets opcionais deve apenas
omitir a decoração da respectiva travessia.

## Ajuste para a embarcação com 64 vistas

A coral junto ao Porto passou de `(1.1726028037900418, 0.7212261318945039)` para
`(1.1658319704567084, 0.7362261318945039)`: deslocamento nativo de `(-13,+18)`
pixels, com comprimento de 22,204 pixels. A verde junto ao Domínio passou de
`(2.567669768444458, -0.8876690091459706)` para
`(2.5717402070184527, -0.8839495042962289)`, 9 pixels pela normal externa do canal.
Os dois sprites e as outras duas posições permanecem iguais.

A seleção usa a curva final do barco, sem alterar os pontos de controle publicados
ou os pontos de embarque. A animação arredonda as curvas entre esses controles.
Foram verificadas 1.034 poses nos dois sentidos e uma reversão em mar aberto,
além de interpolação a cada até 2 pixels nativos, silhuetas adjacentes, envelope
completo de Feka e os dois traços quadráticos da esteira. A coral mantém
14/90/4 pixels de folga de casco/passageiro/esteira; a verde mantém 5/98/65.
As distâncias de terra/cais aumentam para 177/197 e 456/443 pixels,
respectivamente. Não há contato com boias, terreno ou cais em mar aberto nas
cinco execuções finais. Os contatos projetados nos terminais são relatados
separadamente e não são apresentados como ausência de contato físico 3D.

Consulte [a auditoria final](diorama/ferry-motion-clearance.json) e
[a escolha de 64 vistas, seu custo e suas âncoras](diorama/ferry-heading-refresh.md).
O empacotador continua lendo as quatro posições da metadata atual, portanto
reproduzir as imagens preserva esses ajustes.

## Integração e validação

O mapa solicita os metadados e as duas imagens uma única vez por instância. As
boias só são desenhadas quando a arte da respectiva travessia está pronta,
independentemente do desbloqueio: portões e controles existentes continuam
decidindo a viagem. Imagem ausente, metadado inválido ou descarte durante o
carregamento não alteram a navegação nem geram alerta de decoração. A chegada
da imagem invalida apenas a pintura, sem reconstruir o grafo de caminhos.

Na integração original das boias, foram aprovados 161 testes focados, ambos os projetos TypeScript e a regressão
completa de 528 testes TypeScript + 3 do servidor em 15,14 segundos. Os
validadores dos três níveis clássicos, assets do jogador e 30 fases/260 frames
World passaram. Vite compilou em 2,31 segundos: JavaScript 497,34 kB (154,06 kB
gzip); CSS inalterado. Esses tempos locais não são medição de FPS no navegador.
