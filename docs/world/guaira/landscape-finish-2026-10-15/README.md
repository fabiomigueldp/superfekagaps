# Guaíra — acabamento da paisagem, revisão 3

Esta revisão parte de `../terrain-polish-2026-10-15/guaira-terrain.blend`. O modelo editável final é [guaira-landscape.blend](guaira-landscape.blend). A [comparação visual](index.html) usa imagens da revisão 2 e da revisão 3 na mesma câmera; o vídeo mostra Feka percorrendo o mapa local.

## Alterações

- Costa: recuos de erosão, estratos com exposição variável e base mais recuada. A antiga faixa escura contínua tem contraste mais baixo. Os contornos continuam na mesma malha fechada, sem placas sobrepostas.
- Praça: fiadas ajustadas às quinas do terraço, juntas desencontradas, fundo de argamassa e capeamento. A abertura foi recortada conforme a escadaria existente, evitando a remoção de blocos inteiros junto à passagem.
- Reservatório: base estrutural e três fiadas de pedra substituem o antigo bloco de terra. A boca de saída foi recortada na própria alvenaria seguindo o plano inclinado da água.
- Canal: leito e paredes laterais fechados, apoiados até o terreno. A superfície de água existente mantém seus vértices.
- Acesso de serviço: pés da plataforma reassentados em sapatas e corrimão acompanhando a escada. Duas agaves da antiga base foram retiradas da alvenaria e replantadas no terreno, com folhas fechadas.

As geometrias substituídas ficam ocultas em uma coleção de referência no arquivo do Blender. A superfície superior da ilha, a pista, a câmera, os percursos de Feka, as oito entradas e os pontos de transporte conservam as coordenadas anteriores.

## Produção e reprodução

Blender 5.2.1 LTS, Cycles CPU, 64 amostras, 1920 × 1200. Cor e profundidade são renderizadas juntas; o empacotamento converte a cor para WebP e a profundidade linear para PNG RG de 16 bits. A água restaurada é renderizada novamente com os objetos finais como oclusores. Os assets do jogo usam a revisão 3 para invalidar o cache.

Na raiz do repositório, usando o executável local do Blender:

1. Abrir a fonte da revisão 2 em background e executar `tools/diorama/guaira_campaign/refine_landscape.py -- --export-inputs`.
2. Executar `python tools/diorama/guaira_campaign/layout_landscape.py` (Shapely 2.1).
3. Reabrir a fonte da revisão 2 e executar `refine_landscape.py`. A opção `--draft` produz uma conferência em 1280 × 800; a execução sem opções salva o modelo final e os renders em `output/guaira/landscape-finish-2026-10-15`.
4. Abrir o modelo final e executar `audit_landscape.py` e `audit_native_paths.py`, este com `--output-dir output/guaira/landscape-finish-2026-10-15`.
5. Executar `build_restored_water.py` no modelo final, com o mesmo diretório de saída, e `package_restored_water.py` apontando para os arquivos gerados.
6. Executar `python tools/diorama/guaira_campaign/package_landscape.py` após as validações. Pillow, NumPy e Shapely são usados no empacotamento.

Os scripts ficam em `tools/diorama/guaira_campaign/`. O mapa integrado pode ser acessado em `/?chapter=guaira`; as regras existentes de progresso e viagem continuam valendo.

## Evidências e limites

[verification.json](verification.json) reúne os resultados desta revisão: malhas fechadas, contornos sem dobras, apoio dos caminhos, passagem da água, projeção e profundidade, envelope do avião, testes automatizados, build e navegação no navegador. [asset-manifest.json](asset-manifest.json) registra os hashes do modelo e dos arquivos empacotados.

A inspeção visual teve uma renderização inicial, ajuste do recorte do canal e uma conferência ampliada que identificou as plantas atravessando a alvenaria. O render final inclui a correção dessas plantas.

O teste no navegador usa contextos novos e isolados, com estado preparado para acessar Guaíra. Ele confere chegada, caminhada, inversão de destino, oito entradas e retornos, telas de 1440 × 1000, 390 × 844 e 844 × 390, movimento reduzido e partida. A tela estreita é emulada; esta revisão não representa teste em aparelho físico nem uma nova conclusão integral de todas as fases.
