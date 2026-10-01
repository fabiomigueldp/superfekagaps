# Guaíra: mapa experimental isolado

Entrada: `/guaira.html`. A maquete de terra vermelha conecta dois experimentos reais: **Estrada do Vento → `/guaira-travessia.html`** e **Curral da Comporta → `/guaira-lab.html`**. Selecionar inicia a caminhada; **Entrar** só funciona na chegada. **Chegar** pula a caminhada. O distrito, o arrozal e a casa da vazão continuam marcos da paisagem, sem fases, bloqueios ou progresso inventados.

O experimento não recebe número de mundo de campanha, não usa `parseMapMetadata`, não importa `WorldGame`, não modifica o atlas de seis mundos e não lê/escreve saves ou placar. A saída pública **Sair** continua apontando para `./`. Nenhum link foi adicionado à campanha. O mapa não altera o servidor Oracle.

## Retornos sem save

- `guaira.html?at=town`: Feka na estrada `guaira-1`, pronto para entrar na travessia
- `guaira.html?at=rice`: Feka no arrozal `guaira-3`, sem destino selecionado; escolher Curral percorre apenas a estrada canônica 3→4
- `guaira.html?at=corral`: Feka no curral `guaira-4`, pronto para entrar na arena

Outros valores caem na estrada. O retorno é uma posição de visita, nunca um desbloqueio persistente. Ao chegar a um dos dois destinos, `history.replaceState` atualiza apenas `at` na URL atual. O modelo não navega sozinho; **Entrar** é sempre uma ação separada.

O laboratório usa **MAPA** / “Voltar ao mapa de Guaíra”, com `href="./guaira.html?at=corral"`, no lugar da saída direta, mantendo apenas três controles na barra. **Sair** no mapa leva ao jogo principal. A travessia retorna a `at=town` antes de seu checkpoint e `at=rice` depois dele ou da conclusão.

## Comportamento

A estrada é a concatenação exata das rotas projetadas `0:1`, `1:2`, `2:3` da câmera Blender. Não há atalhos desenhados sobre a água. Trocar de destino durante a caminhada inverte o movimento a partir da posição atual. A posição é medida em comprimento de estrada no quadro 1920×1200, com 170 pixels desse quadro por segundo.

O ator usa diretamente as matrizes e a paleta originais de Feka. A escala física coincide com a auditoria da maquete: `(4.15 / 20.6) × 3 / 384` da largura do quadro por pixel do ator. A cena conserva renderização suave, e o ator/placas conservam pixels duros. O modo de movimento reduzido chega imediatamente e remove interpolação de câmera e caminhada. A câmera de celular acompanha Feka; **Ver mapa** mostra a ilha inteira. Destinos fora do enquadramento continuam disponíveis nos botões do painel.

Todos os controles usam botões ou links nativos, com área de pelo menos 44 CSS pixels, nome acessível, foco visível e alternativa textual em alto contraste. Setas esquerda/direita selecionam o destino; Tab e Enter/Espaço operam os controles nativos. Sair, fechar a página e bfcache suspendem/descartam o controlador. Ocultar a aba cancela o quadro pendente e evita salto de tempo ao retornar.

Metadados/imagem inválidos exibem um estado terminal com links para as duas experiências. A validação JSON ocorre antes de aguardar a imagem. Acesso direto às duas rotas também fica disponível enquanto a cena carrega; lentidão sem erro não dispara timeout arbitrário. Uma conclusão tardia de carregamento após sair nunca inicia o mapa.

## Arte e reprodução

Asset: `public/assets/world/experimental/guaira/guaira-diorama.webp`, RGBA WebP qualidade 94, 1920×1200. A codificação conserva exatamente o canal alpha e reduz o download do original lossless de 893.266 bytes; o manifesto registra o tamanho final. A textura vem do render Blender original; nenhuma concept art foi colocada no runtime. Metadados preservam todas as coordenadas projetadas, com apenas a descrição de status adaptada ao experimento. O manifesto em `tools/diorama/guaira/manifest.json` registra hashes e proveniência. Fontes Blender/Python ficam em `tools/diorama/guaira`; `.blend`, masters PNG e provas não são enviados ao site.

Reproduzir fora do repositório de produção, com Blender 4.3.2 e Pillow:

```sh
blender -b -t 8 --python tools/diorama/guaira/build_guaira.py -- --output-dir /tmp/guaira-render
python tools/diorama/guaira/package_guaira.py --input /tmp/guaira-render --output public/assets/world/experimental/guaira
```

A fonte usa Cycles CPU, 48 amostras e nenhum denoiser. `--draft` não pode ser empacotado. Alterar a cena exige rever projeções, caminhos e legibilidade.

## Verificação e limites

Os testes próprios cobrem os dois destinos, o retorno neutro do arrozal, reversões rápidas, entrada antes da chegada, skip, movimento reduzido, limites de câmera, erro explícito com decode pendente, carregamento lento, descarte ao sair e restauração bfcache. O teste do entrypoint usa o controlador de produção com EventTarget e ambiente DOM mínimo, tornando qualquer acesso a `localStorage` um erro.

As provas offline usam o pintor real da cena/ator e das placas; cabeçalho e painel são composições equivalentes, não capturas de browser. Incluem desktop, celular, 320×480, 472×303 e paisagem. Os testes matemáticos de viewport verificam o retângulo 16×26 de todos os frames, mas não provam oclusão 3D animada. A auditoria Blender original cobre pixels do sprite parado. Layout CSS real, toques nativos e recorte móvel precisam de QA em navegador pelo integrador antes de uma alegação de validação visual completa.

As provas e logs ficam fora da árvore de produção; esta entrega não publica nem altera o jogo principal.
