# Fábrica de Suco · terceiro diorama

A fábrica mantém os cinco locais da campanha: recebimento de barris, linha de envase, tanques de mistura, pressão máxima e controle de qualidade. O caminho de inspeção tem apoio contínuo. Uma passarela seca e mais estreita liga 3-3 a 3-5, como a passagem de manutenção descrita na campanha. A composição e a câmera foram revistas antes do detalhamento; os cinco pontos e as rotas ficaram congelados na referência aprovada.

O conjunto foi modelado e renderizado no Blender instalado, com fonte Python original. A imagem conceitual `03-fabrica-de-suco.png`, a campanha e a história orientaram o metal azul, o suco roxo, a espuma lilás, o cobre, os indicadores verde-limão e a apresentação comercial de Calabrezzo. Não houve importação de modelos, texturas ou personagens de terceiros. A gota e a placa de fabricante são geometria própria; nomes nas fachadas pertencem à ficção do jogo.

A base costeira irregular usa malhas explícitas e alvenaria assentada, sem operações Boolean. A linha de envase tem roletes e bicos de enchimento; os tanques têm cintas, nível de líquido e espuma; os tubos têm flanges e suportes. O posto de qualidade usa cobertura plana e janela panorâmica, distinguindo-se do galpão fabril. Equipamentos ocupam áreas recuadas, deixando o caminho claro. As rampas têm superfícies contínuas, vigas e pilares. Os perfis de pavimento foram unidos com junções calculadas, evitando sobreposição de faces coplanares.

## Reprodução

```sh
blender -b -t 12 -P tools/diorama/render_fabrica_map.py -- --final
python tools/diorama/package_fabrica_map.py
```

A reconstrução sem render usa `-- --audit-only` e escreve a auditoria em um diretório temporário. A exportação final a partir do cache descartável usa:

```sh
blender -b /tmp/fabrica-map-prototype.blend -t 12 -P tools/diorama/render_fabrica_cached.py
python tools/diorama/package_fabrica_map.py
```

O cache contém seus próprios metadados de navegação; a exportação do cache não depende de um JSON possivelmente pertencente a outro modelo. A reconstrução canônica entrega seus metadados recém-calculados diretamente às auditorias. O PNG final tem 1920×1200 RGBA, Cycles com 160 amostras e sem denoise. O WebP usa qualidade 91. Apenas WebP e JSON de metadados são assets de runtime. PNG, lossless, cache e imagens de revisão ficam locais/ignorados. O empacotamento compara os cinco nós, as rotas e a câmera com `fabrica-composition-approved.meta.json`, verifica os gates geométricos, mede os limites alfa e exige menos de 350.000 bytes para o par publicado. O par final soma 152.456 bytes (147.156 de imagem e 5.300 de metadados). Tamanho e hashes estão em `fabrica-art-manifest.json`.

## Verificação da navegação

`check_fabrica_clearance.py` faz 660 amostras de apoio e 660 de espaço livre, incluindo centro e bordas do percurso. O piso deve ser uma superfície explicitamente caminhável, a até 0,16 unidade abaixo do pé. O espaço livre é examinado até 0,88 unidade acima; alterações de altura entre amostras também são registradas. O envelope físico projetado usa 2.640 raios em direção à câmera, cobrindo um corpo de 0,52×0,98 unidade. Todos esses testes precisam passar antes da exportação.

`check_fabrica_billboard.py` trata separadamente o sprite desenhado pelo runtime, cujo tamanho mínimo em pixels o torna proporcionalmente maior em telas pequenas. `measure_fabrica_envelopes.ts` recalcula os envelopes a partir do código real de câmera/ator; o relatório completo fica em `.cache/diorama/`. `fabrica-runtime-envelopes.json` registra medidas dos modos fechado/panorama para desktop, retrato de 400 e 320 pixels, paisagem, larguras de 640 e 641 pixels e editor. Cada perfil recebe raios na sua projeção própria: cenário situado atrás do personagem não é tratado como obstrução frontal. O teste registra os objetos e a altura relativa de cada contato. A execução final fez 52.800 amostras: zero contatos com equipamento e 438 contatos conservadores com bordas de caminho/guarda-corpos, todos nos 25% inferiores do retângulo. Os dados não prometem cobertura de tamanhos arbitrariamente pequenos ou transições de redimensionamento.

Na revisão, o reservatório de pressão foi recuado na área externa e os barris do recebimento foram deslocados para fora do corredor. Isso eliminou os contatos de equipamento nos perfis medidos sem mudar câmera, nós ou rotas. Contatos conservadores com pavimento e guarda-corpos nas bordas do retângulo do sprite continuam registrados como `path-edge-or-guardrail`; eles não são apresentados como zero geral de sobreposição. A presença do personagem real e a leitura desses contatos precisam também ser verificadas no navegador. Os testes geométricos não substituem essa inspeção visual nem testam desempenho.

As rotas e o HUD da aplicação são integrados e verificados em trabalho separado. O teste de rejeição elevou deliberadamente a origem de uma rota: 45 amostras sem apoio foram rejeitadas e o arquivo anterior de metadados permaneceu idêntico, byte a byte. A substituição do JSON usa um arquivo temporário somente depois de todos os gates. Nenhum acesso ou implantação no servidor Oracle faz parte deste pipeline.
