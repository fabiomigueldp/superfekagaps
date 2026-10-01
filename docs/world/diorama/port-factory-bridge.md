# Ponte de carga Porto → Fábrica

A ligação preserva a transição de `docs/world/campanha.md:66`: depois de B1, a ponte de carga baixa e conecta o porto à fábrica. Feka cruza a pé. O barco continua atendendo à rota Costa↔Porto, com seu cais e percurso inalterados.

## Geografia e percurso

Costa permanece em `(0, 0)` e Porto em `(1.1, -0.12)`, escala 1. A Fábrica fica em `(1.98, 0.03)`, escala 1. Os cinco pontos de fase, quatro percursos principais, atalho de manutenção `3-3→3-5`, câmera e quadro `1920×1200` da Fábrica foram recuperados do marco `eab1a34addb278a898e95a1c9e77bcd8b2de68e6` e preservados.

A nova junção do Porto fica na metade do primeiro segmento de `2-4→2-5`, em `[4.575, -1.225, 1.692]`. Partindo do chefe, Feka usa a rampa já existente e o pátio inferior antes de alcançar a ponte. A saída foi afastada do guarda-corpo da rampa depois de uma checagem da projeção do personagem. O outro lado chega a um patamar apoiado e ao recebimento `3-1`. Apenas um pequeno arbusto costeiro foi deslocado 0,38 unidade para oeste para liberar esse acesso.

O vão articulado mede aproximadamente 5,54 unidades, com largura de 1,48. O desnível de 0,512 unidade resulta numa inclinação de 5,30°. A face inferior do tabuleiro fica a 0,96 unidade da água no lado baixo; as vigas laterais chegam a aproximadamente 0,865. O estudo levantado usa 70°. Este pacote fornece dois estados estáticos; não inclui animação intermediária nem novos mecanismos de gameplay.

## Exportação e contrato

`port-factory-bridge.meta.json` contém as junções, aproximações locais, limites de cada aproximação, placements aprovados e os dois pontos da travessia em coordenadas de atlas. Os overlays aberto e fechado incluem os encontros fixos. O personagem central não exige uma camada frontal adicional: as amostras do billboard completo ficaram livres.

Os dois overlays são recortes RGBA de um quadro de autoria com escala nativa de 1920 pixels por unidade horizontal e 1200 por unidade vertical do mapa. `left` e `top` são coordenadas de atlas; `widthInMap=width/1920` e `heightInMap=height/1200`. A exportação usa Cycles com 48 amostras, sem denoise, e WebP qualidade 93. A Fábrica usa 96 amostras, sem denoise, e WebP qualidade 91. Os cinco arquivos de runtime somam 253.152 bytes neste pacote; hashes e tamanhos estão no manifesto.

O arquivo Blender conjunto usa um pequeno registro afim para acomodar a diferença entre as câmeras ortográficas históricas, preservando alturas e a composição projetada. As câmeras/fontes originais continuam independentes. O runtime recebe somente imagens e JSON; não carrega Blender ou geometria 3D.

## Verificação

- 357 amostras de apoio e espaço livre no novo percurso: zero falhas
- 1.428 raios para o envelope físico projetado: zero contatos
- 3.990 raios para o billboard na escala real de `WorldAtlasArt.ts`: zero contatos superiores ou inferiores
- 11.220 raios com a ponte levantada contra todos os percursos originais do Porto: zero contatos da ponte
- Revisão dos pixels recompostos das imagens exportadas, incluindo o Feka original no centro da ponte

O billboard usa a grade original 16×26, ampliada 3× no quadro de barco de 384 pixels/orthoScale 4,15. A largura resultante é 0,51875 unidade e a altura projetada 0,842969. Os raios cobrem cinco posições horizontais e seis alturas a cada no máximo 0,08 unidade. A checagem não substitui testes de interação, estados de progressão, enquadramento móvel ou animação no runtime.

## Reprodução

As fontes usam apenas Blender, Python e Pillow. `FEKA_BRIDGE_OUT` permite escolher um diretório de trabalho; o padrão é `/tmp/feka-port-factory-bridge`.

```sh
blender -b -t 8 -P tools/diorama/render_port_factory_bridge.py
blender -b -t 8 -P tools/diorama/check_port_factory_bridge.py
blender -b -t 8 -P tools/diorama/render_port_factory_bridge_layers.py -- open
blender -b -t 8 -P tools/diorama/render_port_factory_bridge_layers.py -- closed
blender -b -t 8 -P tools/diorama/render_port_factory_bridge_layers.py -- factory
python tools/diorama/package_port_factory_bridge.py
```

O empacotador prepara os arquivos no diretório de trabalho. `--install-assets` copia somente os cinco assets finais e os relatórios depois dos gates. Não há acesso, comando ou implantação Oracle neste pipeline.
