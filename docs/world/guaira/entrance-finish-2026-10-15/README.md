# Guaíra — acabamento das entradas, revisão 5

15/10/2026. [Comparação e detalhes](index.html) · [modelo editável](guaira-entrances.blend) · [verificação](verification.json).

Construído sobre `../phase-landmarks-2026-10-15/guaira-landmarks.blend`. Esta rodada refina a construção dos lugares definidos na revisão 4. Os oito acessos e doze percursos mantêm suas posições.

## Peças e encaixes

- Galeria: removidas as molduras sobrepostas; arco de pedra dimensionado para o vão da oficina, tábuas ajustadas ao arco, ferragens, lanterna com suporte e soleira assentada.
- Curral: brasão bovino esculpido com chifres curvos afilados e cavidades, ferragens, bases mais baixas na cerca, cocho com paredes e fundo reais e soleira em rampa. Uma rachadura da antiga superfície, suspensa sobre o pátio nivelado, foi retirada.
- Câmara: coletor vazado, grade inclinada com dobradiças e alça, manômetro ligado à cobertura. O pavimento antigo foi recortado sob a parede para não preencher a cavidade.
- Respiros: dois volumes ocos com grades assentadas e coletor compartilhado visível, sobre uma base com apoio no terreno.
- Elevador: guias, carro, roldana com eixo e suportes, cabo contínuo, tambor, manivela, travamentos e degraus. O acesso foi unido geometricamente à rua; não existe uma camada de pavimento sobreposta.
- Materiais: variação discreta da madeira e arestas chanfradas. As fases, a restauração de água e as regras de progresso continuam usando o jogo nativo.

## Rodadas de revisão

A primeira prévia revelou a pedra superior do arco próxima demais da cabeça de Feka. A inspeção ampliada encontrou superfícies coincidentes na soleira, responsáveis por uma faixa preta, e uma borda de pavimento dentro do coletor. A passagem seguinte corrigiu esses três encontros. As ampliações desta página foram renderizadas da fonte final, com a mesma câmera e o dobro da resolução antes do recorte; a imagem do jogo e sua profundidade usam 1920 × 1200.

## Verificação final

- 583 testes aprovados; build de produção, validadores e os dois projetos TypeScript aprovados.
- 496 malhas verificadas fechadas, conectadas, com volume positivo e sem faces degeneradas; 202 novos sólidos.
- 21 bases conferidas, sem falta de apoio. Quatro cavidades livres até os respectivos fundos, com profundidades medidas entre 0.143 e 0.180 m.
- 99 sondagens do canal, sem obstrução ou falta de apoio.
- 590 amostras dos percursos e 1770 sondagens de apoio, sem buracos ou contatos com o corpo.
- 1374 amostras de profundidade, com a cabeça de Feka visível nos oito acessos. O telhado do aeroporto continua ocultando parcialmente o personagem ao passar por baixo.
- 1780 poses de voo e 1230 contatos de rodas; margem conservadora de 5 cm, sem colisões, margens não resolvidas ou rodas sem suporte.
- Navegador: entrada e retorno das oito cenas, reversão, pulo de caminhada, movimento reduzido, chegada e partida. 1276 quadros de caminhada em computador e 852 em tela estreita, sem perda de enquadramento nem placas cobrindo Feka; nenhum erro de página.
- Água restaurada renderizada da fonte atual: 8 recortes e 2266 pixels de trabalho.

O [manifesto](asset-manifest.json), os [dados de navegação](navigation.json) e o [relatório geométrico](entrance-integrity.json) identificam os arquivos utilizados. A fonte final tem o mesmo SHA-256 nos relatórios de geometria, avião e ampliações. A revisão de cache dos assets é 5; o terreno conserva a revisão 4.

As verificações cobrem os percursos e as interações descritos; esta rodada não é uma nova conclusão manual de toda a campanha nem um teste em aparelho móvel físico. Não houve publicação remota.

## Reproduzir

Na raiz do projeto, use Blender 5.2.1 LTS e Python com Shapely 2.1, Pillow e NumPy. O autor sempre parte da fonte da revisão 4. Peças substituídas ficam ocultas numa coleção de referência. `--draft` gera uma prévia de 1280 × 800, 16 amostras; o final usa Cycles CPU, 64 amostras, 1920 × 1200.

```powershell
$blenderExe = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'
$sourceV4 = 'docs/world/guaira/phase-landmarks-2026-10-15/guaira-landmarks.blend'
$sourceV5 = 'docs/world/guaira/entrance-finish-2026-10-15/guaira-entrances.blend'
$entranceOut = 'output/guaira/entrance-finish-2026-10-15'
& $blenderExe -b $sourceV4 -P tools/diorama/guaira_campaign/inspect_entrance_finish.py
python tools/diorama/guaira_campaign/layout_entrance_finish.py
& $blenderExe -b $sourceV4 -P tools/diorama/guaira_campaign/finish_entrances.py
& $blenderExe -b $sourceV5 -P tools/diorama/guaira_campaign/audit_entrance_finish.py
& $blenderExe -b $sourceV5 -P tools/diorama/guaira_campaign/audit_native_paths.py -- --output-dir $entranceOut
& $blenderExe -b $sourceV5 -P tools/diorama/guaira_campaign/build_restored_water.py -- --output-dir $entranceOut
python tools/diorama/guaira_campaign/package_restored_water.py --input "$entranceOut/guaira-water-restored.png" --source "$entranceOut/restored-water-source.json"
python tools/diorama/guaira_campaign/package_entrance_finish.py
```
