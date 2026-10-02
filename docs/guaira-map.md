# Guaíra: mapa experimental isolado

Entrada: `/guaira.html`. A maquete de terra vermelha mantém três destinos permanentes: **Estrada do Vento → `/guaira-travessia.html`**, **Arena do Curral → `/guaira-lab.html`** e **Subida à Casa → `/guaira-subida.html`**. Arena e Subida partem do mesmo marco do curral; são escolhas distintas, com ações **ARENA** e **SUBIR**. Selecionar inicia a caminhada; a ação de entrada só funciona na chegada ao ponto de partida. **Chegar** pula a caminhada. O distrito e o arrozal continuam marcos da paisagem. Ao chegar à Casa da Vazão, o botão principal oferece **PREFEITO → `/guaira-prefeito.html`**, explicitamente descrito como experimento opcional. **VOLTAR** inicia a caminhada de volta ao curral. Não há quarto destino permanente, entrada automática, desbloqueio ou progresso inventado.

O experimento não recebe número de mundo de campanha, não usa `parseMapMetadata`, não importa `WorldGame`, não modifica o atlas de seis mundos e não lê/escreve saves ou placar. A saída pública **Sair** continua apontando para `./`. Nenhum link foi adicionado à campanha. O mapa não altera o servidor Oracle.

## Retornos sem save

- `guaira.html?at=town`: Feka na estrada `guaira-1`, pronto para entrar na travessia
- `guaira.html?at=rice`: Feka no arrozal `guaira-3`, sem destino selecionado; escolher Curral percorre apenas a estrada canônica 3→4
- `guaira.html?at=corral`: Feka no curral `guaira-4`, pronto para entrar na arena; escolher Subida troca a experiência sem caminhar
- `guaira.html?at=vazao`: Feka no terraço `guaira-5`, sem destino selecionado; **PREFEITO** entra no experimento opcional; **VOLTAR**, Arena ou Subida voltam ao curral pela rota `3:4` ao contrário

Outros valores caem na estrada. O retorno é uma posição de visita, nunca um desbloqueio persistente. Ao chegar a um ponto de partida, `history.replaceState` atualiza apenas `at` na URL atual. Arena e Subida gravam a mesma posição de visita `at=corral`; a seleção de experiência não é persistida. O modelo não navega sozinho; **JOGAR**, **ARENA**, **SUBIR** ou **PREFEITO** são sempre uma ação separada. Recarregar durante uma caminhada restaura a última chegada registrada na URL; não salva uma posição intermediária.

O laboratório usa **MAPA** / “Voltar ao mapa de Guaíra”, com `href="./guaira.html?at=corral"`, no lugar da saída direta, mantendo apenas três controles na barra. **Sair** no mapa leva ao jogo principal. A travessia retorna a `at=town` antes de seu checkpoint e a `at=rice` depois dele ou da conclusão. A Subida retorna a `at=corral` antes da conclusão e a `at=vazao` depois dela. O Prefeito retorna explicitamente a `at=vazao`, inclusive quando pausado, sem retomar ou reiniciar o encontro por chegar ao mapa.

### Contrato da ação contextual

- Casa, `selected=null`, controlador aberto e parado: principal **PREFEITO** habilitado; **VOLTAR** visível; os três destinos permanentes continuam disponíveis
- **VOLTAR** seleciona `curral`; não muda a posição no clique. O ator percorre `3:4` ao contrário e só então habilita **ARENA**. Apenas **Chegar** ou movimento reduzido pulam a caminhada
- Selecionar qualquer destino remove imediatamente a ação contextual, mesmo antes do primeiro quadro. Um clique atrasado em **VOLTAR** não substitui uma escolha mais recente; um clique em entrada consulta o estado atual, nunca um `href` antigo
- Arrozal sem seleção: entrada desabilitada e **VOLTAR** oculto. Em movimento: entrada desabilitada e **CHEGAR** disponível. Curral: **ARENA** ou **SUBIR**, conforme a seleção
- Carregamento: ações do mapa desabilitadas. Falha: somente links diretos. Saída: modelo fechado, sem segunda navegação em cliques repetidos. Reload e bfcache reconstroem o contexto a partir de `at`

## Comportamento

A estrada é a concatenação exata das rotas projetadas `0:1`, `1:2`, `2:3`, `3:4` da câmera Blender, conservando todos os pontos projetados. Tabelas explícitas de distâncias por marco, chegada e experiência mantêm o curral em `guaira-4`, mesmo com o fim da estrada em `guaira-5`. As duas experiências do curral têm a mesma distância física. Não há atalhos desenhados sobre a água. Trocar de destino durante a caminhada inverte o movimento a partir da posição atual. A posição é medida em comprimento de estrada no quadro 1920×1200, com 170 pixels desse quadro por segundo.

O ator usa diretamente as matrizes e a paleta originais de Feka. A escala física coincide com a auditoria da maquete: `(4.15 / 20.6) × 3 / 384` da largura do quadro por pixel do ator. A cena conserva renderização suave, e o ator/placas conservam pixels duros. O modo de movimento reduzido chega imediatamente e remove interpolação de câmera e caminhada. A câmera de celular acompanha Feka; **Ver mapa** mostra a ilha inteira. Destinos fora do enquadramento continuam disponíveis nos botões do painel.

Todos os controles usam botões ou links nativos, com área de pelo menos 44 CSS pixels, nome acessível, foco visível e alternativa textual em alto contraste. Seta esquerda seleciona Travessia, direita seleciona Arena e cima seleciona Subida; Tab e Enter/Espaço operam os controles nativos. Sair, fechar a página e bfcache suspendem/descartam o controlador. Ocultar a aba cancela o quadro pendente e evita salto de tempo ao retornar.

Metadados/imagem inválidos exibem um estado terminal com links para os quatro experimentos, incluindo Prefeito opcional. A validação JSON ocorre antes de aguardar a imagem. Esses links diretos também ficam disponíveis enquanto a cena carrega e podem quebrar linha; não são destinos permanentes da barra. Lentidão sem erro não dispara timeout arbitrário. Uma conclusão tardia de carregamento após sair nunca inicia o mapa.

## Arte e reprodução

Asset: `public/assets/world/experimental/guaira/guaira-diorama.webp`, RGBA WebP qualidade 92, 1920×1200, 189.388 bytes. O passe Blender v2 enriquece fachada e tubulações, falésias/solo e margens irrigadas; substitui a base anterior de 195.902 bytes, sem camada ou textura adicional. A codificação conserva exatamente o alpha do novo PNG correspondente; nenhuma concept art foi colocada no runtime. Metadados, incluindo artBounds, câmera, cinco âncoras e quatro rotas, continuam byte-idênticos. O manifesto em `tools/diorama/guaira/manifest.json` registra hashes e proveniência. Fontes Blender/Python ficam em `tools/diorama/guaira`; `.blend`, masters PNG e provas não são enviados ao site.

Reproduzir fora do repositório de produção, com Blender 4.3.2 e Pillow:

```sh
blender -b -t 8 --python tools/diorama/guaira/build_guaira.py -- --output-dir /tmp/guaira-render
python tools/diorama/guaira/package_guaira.py --input /tmp/guaira-render --output public/assets/world/experimental/guaira
```

A fonte usa Cycles CPU, 48 amostras e nenhum denoiser. `--draft` não pode ser empacotado. Alterar a cena exige rever projeções, caminhos e legibilidade.

## Verificação e limites

Os testes próprios cobrem os três destinos permanentes, o retorno neutro do arrozal, a entrada contextual da casa, o retorno do Prefeito pausado, o percurso exato da casa ao curral, a troca de experiência sem deslocamento, reversões rápidas, entrada antes da chegada, cliques atrasados após nova seleção, skip, movimento reduzido, limites de câmera, erro explícito com decode pendente, carregamento lento, descarte ao sair, reload e restauração bfcache. O teste do entrypoint usa o controlador de produção com EventTarget e ambiente DOM mínimo, tornando qualquer acesso a `localStorage` um erro. O retorno pausado verifica o link nativo e o modelo reconstruído; a navegação real é responsabilidade do QA em navegador.

As provas offline usam o pintor real da cena/ator e das placas; cabeçalho e painel são composições equivalentes, não capturas de browser. Incluem desktop, celular, 320×480, 472×303 e paisagem. As três placas de escolha medem 118 + 70 + 82 px, com dois intervalos de 8 px: cabem na área de 296 px de uma tela de 320 px. Na Casa, as placas contextuais **VOLTAR** (82 px) e **PREFEITO** (106 px) mantêm 44 px de altura, empilhadas com intervalo de 5 px no modo compacto. Em telas estreitas e baixas, as escolhas ocupam uma linha inteira, e as ações ficam na linha seguinte. Painéis de carregamento/falha permitem rolagem desde o início. Os testes matemáticos de viewport verificam o retângulo 16×26 de todos os frames. No passe Blender v2, 760.800 raios cobrem a união de 317 pixels opacos dos sete frames (idle e seis de caminhada), cinco amostras por pixel, ambos os lados e 240 posições de rota; não houve oclusão de cabeça, rosto, corpo ou pés. Os 720 probes de apoio passaram, e 16 meshes de caminhada mantêm vértices, faces, transforms e modificadores exatos. Esse é um audit geométrico estático com todas as silhuetas, distinto do QA de movimento, foco, CSS e recorte no navegador. Dispositivos físicos e calibração humana continuam verificações separadas.

As provas e logs ficam fora da árvore de produção; esta entrega não publica nem altera o jogo principal.
