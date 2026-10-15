# Guaíra — revisão do terreno e da ilha

15/10/2026 · [Comparativo e caminhada](index.html) · [Blender editável](guaira-terrain.blend) · [Verificação](verification.json).

## Alterações

A ilha e o antigo volume da pista foram substituídos por uma única malha fechada. O contorno compartilha 297 vértices entre superfície e camadas laterais, sem as antigas placas triangulares sobrepostas. A faixa de terra batida agora é uma transição de material na própria superfície. A área original de contato das rodas permanece nivelada.

O solo tem elevações suaves nos espaços livres, com as alturas preservadas sob caminhos, construções, canais e objetos. Dez afloramentos baixos substituem o aspecto de pequenos pedestais; seis grupos de capim seco acompanham as margens. As 107 fissuras visíveis foram assentadas no relevo; duas curvas que saíam do novo contorno ficaram ocultas para não descer pela falésia.

A primeira passagem apresentou vincos nos segmentos curtos do contorno. Eles foram corrigidos usando contornos radiais coerentes e revisando o sombreamento das faces laterais. A segunda passagem ajustou proporções e cores das camadas. A terceira retirou as fissuras que ultrapassavam a borda e gerou a arte final.

Os pontos 3D, projeções, durações e alturas de todas as rotas e entradas são idênticos aos da revisão de 13/10. A câmera e os pontos de transporte também foram mantidos. O terreno foi exportado com sua profundidade; a água restaurada foi renderizada novamente e mantém as oito áreas de movimento, com 2.266 pixels auxiliares. O carregamento usa a revisão da arte e o hash da água para evitar cache antigo.

## Verificação

- As 53 novas malhas são fechadas, possuem um componente conectado, volume positivo e nenhuma face degenerada no exame geométrico.
- 571 amostras dos caminhos, 1.713 sondagens de apoio: nenhum ponto sem apoio ou contato lateral do volume de teste.
- 41 pontos adicionais na antiga emenda da pista e nas margens dos canais: todos apoiados.
- 1.326 amostras de profundidade. As oito entradas preservam a visibilidade da cabeça de Feka. A oclusão parcial sob o abrigo do desembarque continua sendo parte da cena.
- 581 testes aprovados e build de produção concluído, incluindo validação de fases, sprites, mundo e os dois projetos TypeScript.
- Navegador: oito entradas/retornos, reversão, câmera estreita, movimento reduzido e saída pelo aeródromo. Em 1.433 quadros de caminhada no desktop e 805 na tela estreita, Feka permaneceu na área útil e sem sobreposição com as placas. Nenhum erro de execução.
- Quatro voos, 1.780 posições amostradas e 1.230 contatos de rodas: nenhuma interseção, nenhum caso pendente na margem conservadora de 5 cm e nenhum contato sem apoio.

As sondagens usam o modelo fonte e a projeção do jogo. O volume de caminhada é conservador; a análise do avião é amostrada a 60 Hz, com margem de 5 cm. Esses resultados não constituem uma simulação física contínua. O navegador usa desktop e viewports menores; não foi necessário alterar controles nesta revisão.

## Reprodução

Partir de `docs/world/guaira/native-map-2026-10-13/guaira-native.blend`, com Blender 5.2+, Python, Shapely 2.1, Pillow e NumPy. Na raiz do repositório:

```text
blender -b docs/world/guaira/native-map-2026-10-13/guaira-native.blend -t 2 -P tools/diorama/guaira_campaign/export_terrain_inputs.py
python tools/diorama/guaira_campaign/layout_terrain.py
blender -b docs/world/guaira/native-map-2026-10-13/guaira-native.blend -t 4 -P tools/diorama/guaira_campaign/refine_terrain.py
blender -b docs/world/guaira/terrain-polish-2026-10-15/guaira-terrain.blend -t 2 -P tools/diorama/guaira_campaign/audit_native_paths.py -P tools/diorama/guaira_campaign/audit_terrain_integrity.py -- --output-dir output/guaira/terrain-polish-2026-10-15
blender -b docs/world/guaira/terrain-polish-2026-10-15/guaira-terrain.blend -t 4 -P tools/diorama/guaira_campaign/build_restored_water.py -- --output-dir output/guaira/terrain-polish-2026-10-15/water
python tools/diorama/guaira_campaign/package_restored_water.py --input output/guaira/terrain-polish-2026-10-15/water/guaira-water-restored.png --source output/guaira/terrain-polish-2026-10-15/water/restored-water-source.json
python tools/diorama/guaira_campaign/package_terrain.py
```

O refinador aceita `-- --draft` para revisão em 1280 × 800 ou `-- --no-render` para salvar apenas o modelo. A saída final usa Cycles CPU, 64 amostras e 1920 × 1200. Os objetos substituídos estão preservados em uma coleção oculta no Blender. `asset-manifest.json` registra os arquivos de runtime; `navigation.json` mantém o contrato exportado.
