# Guaíra — lugares das fases, revisão 4

Revisão de 15/10/2026, construída sobre `../landscape-finish-2026-10-15/guaira-landscape.blend`.
Fonte editável atual: [guaira-landmarks.blend](guaira-landmarks.blend).
[Comparação, localização das fases e caminhada](index.html).

O objetivo desta rodada foi tornar reconhecíveis os lugares das fases no modelo e no mapa nativo. O curral ganhou um recinto, portão e ramal próprios. As outras intervenções relacionam cada entrada às mecânicas efetivamente presentes nas cenas.

| Acesso | Lugar e referência física | Papel no capítulo |
|---|---|---|
| Travessia da Vala Seca | Estrada do Vento; válvula no pilar da comporta seca | Uma das duas escolhas da etapa 1 |
| Pátio das Comportas | Bancada com dois controles A/B e alimentação compartilhada | Outra escolha da etapa 1 |
| Passagem dos Respiros | Duas grades de pressão, manômetros e coletor junto aos arrozais | Etapa 2 |
| Ossabravo | Curral da Comporta; chão compactado, cerca baixa, cocho seco e portão com brasão de chifres | Etapa 3 |
| Subida à Casa da Vazão | Escadaria e pequeno elevador de inspeção ao lado do canal | Etapa 4 |
| Prefeito da Vazão | Casa elevada, registro público e três selos na fachada | Etapa 5 |
| Galeria dos Remendos | Subsolo da oficina; alvenaria reparada e lanterna | Desvio G, opcional |
| Câmara de Alívio | Coletor; alçapão, manômetro e tubo de retorno | Desvio A, opcional |

A placa B indica a abertura alternativa à escolha atual, antes do primeiro recibo. O capítulo continua exigindo cinco etapas; visitar o mapa ou caminhar não concede conclusão. As duas opções de abertura não são duas etapas obrigatórias. A arte do mapa não antecipa a restauração da água pública.

## Modelo e navegação

- O novo ramal liga `corral-junction` `(3.10, 0.15, 1.835)` à chegada de Ossabravo `(2.44, 0.15, 1.835)`, diante do portão. A via principal segue até a Subida sem atravessar a entrada do chefe.
- O pavimento foi unido geometricamente ao novo ramal. O nivelamento afeta 59 vértices do pátio do curral e sua transição; a costa e o terreno do aeroporto preservam a revisão anterior.
- Os sete outros acessos, a câmera, os pontos de transporte e as superfícies de água mantêm suas coordenadas. A família de cactos foi deslocada como conjunto para liberar a cerca traseira.
- O arquivo tem oito coleções nomeadas por fase e oito objetos `ENTRADA | …`. Os objetos dessas coleções carregam `stage_id`; os marcadores guardam o lugar e a referência visual.
- `navigation.json` contém as rotas e o bloco `landmarks`, exportado da mesma cena. O mapa usa esse bloco para identificar o lugar no painel nativo e nos rótulos acessíveis. Os desvios G/A substituem as duas estrelas indistintas.
- Beleza, profundidade e água restaurada foram exportadas novamente. A revisão de cache é 4. A primeira revisão visual identificou contatos junto ao brasão do curral e à verga da galeria; o modelo final corrige ambos.

## Verificação

O [relatório verificável](verification.json) e o [manifesto dos arquivos](asset-manifest.json) identificam a fonte final pelo SHA-256.

- 583 testes passaram; build de produção, validadores e os dois projetos TypeScript passaram.
- 430 malhas verificadas são fechadas, conectadas, têm volume positivo e não têm faces degeneradas. São 241 novos sólidos, incluindo o pavimento e suas bordas.
- 22 bases apoiadas e 99 amostras do canal sem obstrução.
- 590 amostras de caminhada, 1.770 sondagens de apoio, nenhum ponto sem suporte ou contato com o corpo.
- 1.374 amostras de profundidade; cabeça de Feka visível nos oito acessos. A cobertura do aeroporto continua ocultando parcialmente o corpo durante a passagem sob o telhado.
- 1.780 poses de voo, 1.230 contatos de rodas e margem conservadora de 5 cm: nenhuma colisão, margem não resolvida ou roda sem apoio.
- Navegador: entrada e retorno das oito cenas, reversão, pulo da caminhada, movimento reduzido, chegada e partida. 1.295 quadros de caminhada em computador e 854 em tela estreita, sem saída do enquadramento ou sobreposição das placas com Feka; nenhum erro de página.
- Água restaurada: oito recortes, 2.266 pixels de trabalho; a área dos recortes permanece igual, com as oclusões renderizadas a partir do modelo atual.

As sondagens geométricas e os testes do navegador verificam os percursos e as interações descritos. Esta rodada não é uma nova conclusão manual de toda a campanha nem uma sessão em aparelho móvel físico. Não houve publicação remota.

## Reproduzir

Execute a partir da raiz do repositório. A etapa de layout usa Python com Shapely 2.1; o empacotamento usa Pillow e NumPy. O render usa Blender 5.2.1 LTS, Cycles CPU, 64 amostras, 1920 × 1200. Use sempre a fonte da revisão 3 ao executar o autor da revisão 4.

```powershell
$blenderExe = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'
$sourceV3 = 'docs/world/guaira/landscape-finish-2026-10-15/guaira-landscape.blend'
$sourceV4 = 'docs/world/guaira/phase-landmarks-2026-10-15/guaira-landmarks.blend'
$landmarkOut = 'output/guaira/phase-landmarks-2026-10-15'
& $blenderExe -b $sourceV3 -P tools/diorama/guaira_campaign/refine_landmarks.py -- --export-inputs
python tools/diorama/guaira_campaign/layout_landmarks.py
& $blenderExe -b $sourceV3 -P tools/diorama/guaira_campaign/refine_landmarks.py
& $blenderExe -b $sourceV4 -P tools/diorama/guaira_campaign/audit_landmarks.py
& $blenderExe -b $sourceV4 -P tools/diorama/guaira_campaign/audit_native_paths.py -- --output-dir $landmarkOut
& $blenderExe -b $sourceV4 -P tools/diorama/guaira_campaign/build_restored_water.py -- --output-dir $landmarkOut
python tools/diorama/guaira_campaign/package_restored_water.py --input "$landmarkOut/guaira-water-restored.png" --source "$landmarkOut/restored-water-source.json"
python tools/diorama/guaira_campaign/package_landmarks.py
```

Antes da renderização final, `--draft` gera uma prévia de 1280 × 800 e 16 amostras em `output`, sem substituir a fonte final. Geometria antiga substituída permanece oculta em uma coleção de referência.
