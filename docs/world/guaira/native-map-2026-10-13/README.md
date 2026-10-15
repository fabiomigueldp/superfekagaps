# Guaíra — ilha e caminhada no mapa do World

Revisão de 13/10/2026. [Comparativo interativo](index.html) · [Modelo editável](guaira-native.blend) · [Verificação](verification.json).

## Resultado

O mapa de Guaíra passa a usar `WorldJourneyModel` para caminhada, inversão durante o trajeto, chegada, entrada e retorno. O avião desembarca no mapa; a fase selecionada vira uma caminhada. Para sair, Feka volta ao aeródromo antes do voo. A seleção salva das fases principais muda apenas na chegada, sem conceder recibos de conclusão.

As seis cenas, incluindo as duas alternativas de abertura, mais Galeria e Câmara de Alívio têm entradas distintas exportadas da geometria. A abertura alternativa continua disponível até o primeiro recibo; os bloqueios permanecem sob as regras existentes. Os opcionais voltam à porta efetivamente visitada, inclusive quando o host informa um destino diferente da entrada inicial.

No Blender, 175 novos sólidos fechados substituem os pisos sobrepostos e discos de parada: três pisos contínuos, sete degraus com leito estrutural, laterais apoiadas, calçamento unido ao patamar, bordas de arenito, tábuas ajustadas e acessos da oficina, câmara, pátio e Vala Seca. As malhas antigas ficam em uma coleção oculta no arquivo editável.

O portão foi recuado após uma primeira auditoria detectar folga insuficiente junto ao suporte da asa. A câmera, a pista, os pontos de embarque e a trajetória do avião mantêm o contrato anterior. A água restaurada foi renderizada novamente; suas oito áreas de animação continuam ocupando 2.266 pixels auxiliares.

## Revisões e evidência

- Corrigida a emenda escura no topo da escada: último degrau unido ao piso superior, sem tampas coplanares.
- Adicionado leito contínuo sob as bordas arredondadas dos degraus.
- Retirados pequenos detritos que invadiam os caminhos novos.
- Corrigida a navegação compacta depois de escolher a abertura B: a placa dos Respiros continua alcançável.
- Ampliado o afastamento das placas para incluir a sombra junto aos pés de Feka.
- 581 testes na suíte de mapas, jornadas, capítulos, voos e integração. O replay nativo de Guaíra inclui suas duas rotas completas, controles de teclado/toque e descarte das cenas.
- Build de produção aprovado, incluindo validação de fases, sprites e mundo.
- Navegador: voo real até Guaíra; reversão; confirmação separada para pular/entrar; entrada e retorno dos oito acessos; passeio em tela estreita; movimento reduzido; caminhada ao aeródromo e voo de saída. Detalhes finais em `verification.json`.
- Toque emulado no Chromium (390 × 844): voo, placas dos Respiros e do Curral, caminhada, entrada e retorno sem conceder conclusões ou gerar erros. Esta verificação não usa um aparelho físico.
- A última revisão do afastamento das placas passou por 191 testes direcionados e novo build. Em 1.516 quadros de caminhada no desktop e 1.131 na tela estreita, o volume de leitura de Feka permaneceu dentro da área útil e sem sobreposição com os botões das placas.
- Geometria: 571 amostras das 11 rotas, 1.713 sondagens de apoio, nenhum ponto sem apoio e nenhum contato lateral do volume de teste. A sondagem considera a altura do degrau vizinho nas quinas dos espelhos.
- Profundidade: 1.326 amostras de percurso com um retângulo conservador de 12 × 26 pixels. Todas as cabeças nas oito entradas permanecem visíveis. A passagem sob o abrigo de desembarque apresenta oclusão parcial esperada; o portão da fase fica fora do telhado.
- Avião: 1.780 posições a 60 Hz nas quatro viagens, sem interseções e sem casos pendentes na margem conservadora de 5 cm. Os 1.230 contatos de rodas com o terreno têm apoio. Essa auditoria é amostrada e se refere ao modelo fonte/projeção; não substitui física contínua de voo.

## Reprodução

Na raiz do repositório, com Blender 5.2+, Python, Shapely, Pillow e NumPy:

```text
blender -b -t 4 -P tools/diorama/guaira_campaign/build.py -- --region guaira --build-only --output-dir output/guaira/native-map-2026-10-13/base
python tools/diorama/guaira_campaign/layout_native_paths.py
blender -b output/guaira/native-map-2026-10-13/base/guaira-campaign.blend -t 4 -P tools/diorama/guaira_campaign/refine_native_map.py
blender -b docs/world/guaira/native-map-2026-10-13/guaira-native.blend -t 4 -P tools/diorama/guaira_campaign/audit_native_paths.py
python tools/diorama/guaira_campaign/package_native_map.py
blender -b docs/world/guaira/native-map-2026-10-13/guaira-native.blend -t 4 -P tools/diorama/guaira_campaign/build_restored_water.py -- --output-dir output/guaira/native-map-2026-10-13/water
python tools/diorama/guaira_campaign/package_restored_water.py --input output/guaira/native-map-2026-10-13/water/guaira-water-restored.png --source output/guaira/native-map-2026-10-13/water/restored-water-source.json
```

O refinador aceita `-- --draft` ou `-- --no-render`. A saída final usa 1920 × 1200, Cycles CPU, 48 amostras e profundidade linear da mesma câmera. `asset-manifest.json` registra os arquivos de runtime. `navigation.json` conserva os pontos 3D, projeções, durações e profundidades. As capturas e o vídeo são do mapa real, sem substituir o ator por uma maquete.

O mapa experimental independente conserva seu contrato histórico. A revisão integrada é acessada por `/?chapter=guaira`, com os bloqueios e o voo da campanha preservados.
