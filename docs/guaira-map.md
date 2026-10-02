# Guaíra: mapa experimental isolado

Entrada: `/guaira.html`. A maquete de terra vermelha mantém três destinos permanentes: **Estrada do Vento → `/guaira-travessia.html`**, **Arena do Curral → `/guaira-lab.html`** e **Subida à Casa → `/guaira-subida.html`**. Arena e Subida partem do mesmo marco do curral; são escolhas distintas, com ações **ARENA** e **SUBIR**. Selecionar inicia a caminhada; a ação de entrada só funciona na chegada ao ponto de partida. **Chegar** pula a caminhada. O distrito e o arrozal continuam marcos da paisagem. Ao chegar à Casa da Vazão, o botão principal oferece **PREFEITO → `/guaira-prefeito.html`**, explicitamente descrito como experimento opcional. **VOLTAR** inicia a caminhada de volta ao curral. Não há quarto destino permanente, entrada automática, desbloqueio ou progresso inventado.

O experimento não recebe número de mundo de campanha, não usa `parseMapMetadata`, não importa `WorldGame`, não modifica o atlas de seis mundos e não lê/escreve saves ou placar. A saída pública **Sair** continua apontando para `./`. Nenhum link foi adicionado à campanha. O mapa não altera o servidor Oracle.

No início da estrada, **JOGAR** mantém a Travessia principal. A ação secundária **PATIO** abre `/guaira-patio.html`, o Pátio das Comportas: um segundo percurso opcional de seleção A/B da água. A escolha só fica disponível quando Feka está parado no início, nunca durante caminhada ou em outro marco. Isso reutiliza o espaço da ação contextual, sem acrescentar um quarto destino permanente. O Pátio retorna ao início se interrompido e ao arrozal com `visit=junction-clear` quando concluído; o resumo indica o trecho real, sem afirmar que a Travessia principal também foi feita. Links diretos do Pátio permanecem disponíveis nos painéis de carregamento/falha.

No arrozal sem destino selecionado, a ação secundária **RESPIROS** abre `/guaira-respiros.html`, uma passagem opcional de descargas de irrigação. **CURRAL** continua a ação principal e caminha pela estrada antes da entrada na arena. A oferta desaparece imediatamente ao selecionar outro destino; cliques atrasados não podem abrir a fase. MAPA nos Respiros retorna sempre ao arrozal, com `visit=respiros-clear` apenas depois da chegada final real. Os painéis de carregamento/falha também conservam o link direto.

## Retornos sem save

- `guaira.html?at=town`: Feka na estrada `guaira-1`, pronto para entrar na travessia
- `guaira.html?at=rice`: Feka no arrozal `guaira-3`, sem destino selecionado; escolher Curral percorre apenas a estrada canônica 3→4
- `guaira.html?at=corral`: Feka no curral `guaira-4`, pronto para entrar na arena; escolher Subida troca a experiência sem caminhar
- `guaira.html?at=vazao`: Feka no terraço `guaira-5`, sem destino selecionado; **PREFEITO** entra no experimento opcional; **VOLTAR**, Arena ou Subida voltam ao curral pela rota `3:4` ao contrário

Outros valores caem na estrada. O retorno é uma posição de visita, nunca um desbloqueio persistente. Ao chegar a um ponto de partida, `history.replaceState` atualiza `at` na URL atual. Arena e Subida usam a mesma posição de visita `at=corral`. O modelo não navega sozinho; **JOGAR**, **ARENA**, **SUBIR** ou **PREFEITO** são sempre uma ação separada. Recarregar durante uma caminhada restaura a última chegada registrada na URL; não salva uma posição intermediária.

O parâmetro opcional `visit` descreve somente o resultado do trecho que acabou de ser deixado: `traversal-clear`, `junction-clear` ou `respiros-clear` em `rice`, `bull-clear` em `corral`, `ascent-clear` ou `mayor-clear` em `vazao`. Valores desconhecidos, parâmetros duplicados e pares incompatíveis são ignorados. O retorno da travessia no checkpoint não inclui resultado; chegar aos arrozais sozinho não prova conclusão. As cenas derivam esse resumo de seus resultados reais, inclusive na pausa; Recomeçar atualiza o link imediatamente para a versão neutra.

Esse resumo orienta o próximo passo: **CURRAL** caminha pela estrada após a travessia; a vitória de Ossabravo recomenda **SUBIR** sem mover Feka do curral; **CASA** ao terminar a Subida leva à oferta opcional do Prefeito; a vitória do Prefeito é reconhecida na Casa e a ação vira **REPETIR**. Selecionar outro destino descarta o resumo do modelo e da URL antes da animação. Reload e voltar/avançar podem reconstruir o resumo da URL daquele item do histórico. Copiar uma URL também copia esse texto de visita; não é prova de conquista, não restaura água/máquinas, não transporta capacete/checkpoint e não bloqueia nem libera experimentos. Uma nova entrada inicia a tentativa normal. Não há acumulador de progresso, `localStorage` ou `sessionStorage`.

O laboratório usa **MAPA** / “Voltar ao mapa de Guaíra”, com `href="./guaira.html?at=corral"`, no lugar da saída direta, mantendo apenas três controles na barra. **Sair** no mapa leva ao jogo principal. Após derrotar Ossabravo, **SUBIR** oferece a continuação explícita para a Casa da Vazão, no lugar de PAUSA; **TENTAR** e **MAPA** continuam disponíveis. Pausar devolve **CONTINUAR** ao mesmo espaço e oculta a continuação até retomar. A travessia retorna a `at=town` antes de seu checkpoint e a `at=rice` depois dele. A Subida retorna a `at=corral` antes da conclusão e a `at=vazao` depois dela. O Prefeito retorna explicitamente a `at=vazao`, inclusive quando pausado, sem retomar ou reiniciar o encontro por chegar ao mapa.

### Contrato da ação contextual

- Casa, `selected=null`, controlador aberto e parado: principal **PREFEITO** habilitado; **VOLTAR** visível; os três destinos permanentes continuam disponíveis
- **VOLTAR** seleciona `curral`; não muda a posição no clique. O ator percorre `3:4` ao contrário e só então habilita **ARENA**. Apenas **Chegar** ou movimento reduzido pulam a caminhada
- Selecionar qualquer destino remove imediatamente a ação contextual, mesmo antes do primeiro quadro. Um clique atrasado em **VOLTAR** não substitui uma escolha mais recente; um clique em entrada consulta o estado atual, nunca um `href` antigo
- Arrozal sem seleção: **CURRAL** inicia somente a caminhada e **RESPIROS** oferece o desvio opcional no espaço da ação contextual. Depois da chegada é necessária outra ação para entrar, inclusive com movimento reduzido. Em movimento: entrada desabilitada e **CHEGAR** disponível. Curral: **ARENA** ou **SUBIR**, conforme a seleção
- Carregamento: ações do mapa desabilitadas. Falha: somente links diretos. Saída: modelo fechado, sem segunda navegação em cliques repetidos. Reload e bfcache reconstroem o contexto validado a partir de `at` e `visit`

## Comportamento

A estrada é a concatenação exata das rotas projetadas `0:1`, `1:2`, `2:3`, `3:4` da câmera Blender, conservando todos os pontos projetados. Tabelas explícitas de distâncias por marco, chegada e experiência mantêm o curral em `guaira-4`, mesmo com o fim da estrada em `guaira-5`. As duas experiências do curral têm a mesma distância física. Não há atalhos desenhados sobre a água. Trocar de destino durante a caminhada inverte o movimento a partir da posição atual. A posição é medida em comprimento de estrada no quadro 1920×1200, com 170 pixels desse quadro por segundo.

O ator usa diretamente as matrizes e a paleta originais de Feka. A escala física coincide com a auditoria da maquete: `(4.15 / 20.6) × 3 / 384` da largura do quadro por pixel do ator. A cena conserva renderização suave, e o ator/placas conservam pixels duros. O modo de movimento reduzido chega imediatamente e remove interpolação de câmera e caminhada. A câmera de celular acompanha Feka; **Ver mapa** mostra a ilha inteira. Destinos fora do enquadramento continuam disponíveis nos botões do painel.

Todos os controles usam botões ou links nativos, com área de pelo menos 44 CSS pixels, nome acessível, foco visível e alternativa textual em alto contraste. Seta esquerda seleciona Travessia, direita seleciona Arena e cima seleciona Subida; Tab e Enter/Espaço operam os controles nativos. Sair, fechar a página e bfcache suspendem/descartam o controlador. Ocultar a aba cancela o quadro pendente e evita salto de tempo ao retornar.

Metadados/imagem inválidos exibem um estado terminal com links para os seis experimentos, incluindo Prefeito, Pátio e Respiros opcionais. A validação JSON ocorre antes de aguardar a imagem. Esses links diretos também ficam disponíveis enquanto a cena carrega e podem quebrar linha; não são destinos permanentes da barra. Lentidão sem erro não dispara timeout arbitrário. Uma conclusão tardia de carregamento após sair nunca inicia o mapa.

## Arte e reprodução

Asset: `public/assets/world/experimental/guaira/guaira-diorama.webp`, RGBA WebP qualidade 92, 1920×1200, 193.260 bytes. O passe Blender v3 acrescenta telhas curvas em cursos, três fachadas com portas/venezianas profundas, desgaste agrupado na base, baia de manutenção e grupo de colheita; assenta a garganta da comporta sem mover a água. Substitui a base anterior de 189.388 bytes, sem camada ou textura adicional. A codificação conserva exatamente o alpha do novo PNG correspondente; nenhuma concept art foi colocada no runtime. Metadados, incluindo artBounds, câmera, cinco âncoras e quatro rotas, continuam byte-idênticos. O manifesto em `tools/diorama/guaira/manifest.json` registra hashes e proveniência. Fontes Blender/Python ficam em `tools/diorama/guaira`; `.blend`, masters PNG e provas não são enviados ao site.

Reproduzir fora do repositório de produção, com Blender 4.3.2 e Pillow:

```sh
blender -b -t 8 --python tools/diorama/guaira/build_guaira.py -- --output-dir /tmp/guaira-render
python tools/diorama/guaira/package_guaira.py --input /tmp/guaira-render --output public/assets/world/experimental/guaira
```

A fonte usa Cycles CPU, 48 amostras e nenhum denoiser. `--draft` não pode ser empacotado. Alterar a cena exige rever projeções, caminhos e legibilidade.

## Água discreta e custo limitado

Um passe decorativo acrescenta reflexos curtos ao reservatório/arrozais e movimento na direção real dos canais. A máscara foi derivada das superfícies de água na câmera Blender, usando pedras, arroz, ponte e tubulações como oclusores, com recuo de um pixel. Feka é desenhado depois do efeito. A base, as rotas e os metadados de navegação não mudam.

O atlas PNG mede 516×306 (18.804 bytes); o buffer reutilizável mede 344×206. A estimativa de atlas RGBA decodificado + buffer é 915.040 bytes (~0,873MiB), sem textura adicional de 1920×1200. É orçamento de superfícies, não memória medida do browser/GPU. O manifesto registra proveniência e hashes; o JSON decorativo é compilado no módulo do mapa.

Com câmera e Feka parados, apenas a união dos quatro recortes de água é restaurada, no máximo30 vezes por segundo. As placas não fazem consultas de layout nesse estado. Durante caminhada/enquadramento, o renderer normal recompõe o quadro completo. O tempo da água é acumulado somente enquanto a decoração está ativa; ocultar a aba suspende RAF e preserva a fase, sem salto na retomada. Reduced motion usa um quadro estático e volta ao agendamento sob demanda. O mapa não tem pausa separada: entrar/sair descarta o controlador. A máscara carrega depois da cena sem bloquear destinos; falha mantém a maquete estática, e conclusão tardia após descarte é ignorada.

Reproduzir a máscara a partir da cena temporária gerada acima:

```sh
blender -b /tmp/guaira-render/guaira-diorama.blend -t 8 --python tools/diorama/guaira/export_water_mask.py -- --output-dir /tmp/guaira-water
python tools/diorama/guaira/package_water.py --input /tmp/guaira-water --asset-output /tmp/guaira-water-package --data-output /tmp/guaira-water-package/GuairaWaterData.json
```

A fonte nunca salva sobre o `.blend` de entrada. O atlas empacotado e o JSON decorativo foram reproduzidos byte a byte. A prova offline de atualização parcial versus quadro completo teve igualdade em48 casos: quatro chegadas, três viewports, DPR1/2 e movimento normal/reduzido. O efeito alterou somente pixels da água no teste de máscara. Isso não é medição de FPS nem validação em dispositivo físico.

### Recibo do passe de arte v3

A cena foi executada de fato no Blender 4.3.2, preservando câmera/luzes, cinco âncoras, quatro rotas, todos os 16 meshes `walk_` e os nove meshes de água. `craft_guaira.py` é executado pela fonte portátil principal. A máscara foi reexportada para os novos oclusores com os mesmos quatro recortes e dimensões; 1.343 pixels alpha do atlas mudaram. Metadados de navegação e `GuairaWaterData.json` continuam byte-idênticos. O delta de base + máscara é +3.256 bytes; o build integrado tem 40.408.353 bytes, dentro de 45.000.000.

O audit diferencial avalia a geometria Blender, incluindo modificadores/curvas e a triangulação nativa de loops, e dispara 643.510 raios em 203 posições de rota, cobrindo os 317 pixels opacos dos sete frames nativos nos dois sentidos e cinco subamostras por pixel. Não há contato com cenário novo, cabeça/rosto obstruído ou nova falta de apoio. Foram preservados e explicitamente contabilizados 6.962 contatos de pé com as próprias clareiras/tábuas/água já existentes, nas três últimas linhas do sprite; dois dos 609 probes de apoio encontram a água no vão preexistente entre tábuas da ponte. Cada contato coincide com objeto e posição do baseline (tolerância de 0,0001 unidade). Isto não é uma alegação de zero interseções absolutas. O pintor de produção compõe Feka sobre a base.

`export_guaira_actor.mjs` extrai os frames nativos e `audit_guaira_craft.py` compara cenas baseline/candidate reproduzidas pelo Blender; ambos aceitam destinos fora da árvore de produção. `tools/diorama/guaira/craft-validation.json` registra o recibo compacto e `manifest.json` registra hashes, render, custo e limites. As provas de comparação e de Feka nos cinco marcos são renders offline do pintor de produção, não screenshots de navegador. O conceito imagegen, masters, `.blend` e provas permanecem fora do runtime. Os 21 testes focados do candidato e os 26 testes de mapa/UI/água da integração passaram, assim como validadores, typechecks e build. Com a nova base/máscara, o pintor real também passou 48 comparações pixel-a-pixel de atualização parcial versus composição completa (quatro chegadas, três viewports, DPR 1/2 e movimento normal/reduzido). Os 1.171 pixels do efeito amostrado ficaram inteiramente dentro da máscara visível, sem pintar oclusores novos.

## Verificação e limites

Os testes próprios cobrem os três destinos permanentes, o retorno neutro do arrozal, a entrada contextual da casa, o retorno do Prefeito pausado, o percurso exato da casa ao curral, a troca de experiência sem deslocamento, reversões rápidas, entrada antes da chegada, cliques atrasados após nova seleção, skip, movimento reduzido, limites de câmera, erro explícito com decode pendente, carregamento lento, descarte ao sair, reload e restauração bfcache. O teste do entrypoint usa o controlador de produção com EventTarget e ambiente DOM mínimo, tornando qualquer acesso a `localStorage` um erro. O retorno pausado verifica o link nativo e o modelo reconstruído; a navegação real é responsabilidade do QA em navegador.

As provas offline usam o pintor real da cena/ator e das placas; cabeçalho e painel são composições equivalentes, não capturas de browser. Incluem desktop, celular, 320×480, 472×303 e paisagem. As três placas de escolha medem 118 + 70 + 82 px, com dois intervalos de 8 px: cabem na área de 296 px de uma tela de 320 px. Na Casa, as placas contextuais **VOLTAR** (82 px) e **PREFEITO** (106 px) mantêm 44 px de altura, empilhadas com intervalo de 5 px no modo compacto. Em telas estreitas e baixas, as escolhas ocupam uma linha inteira, e as ações ficam na linha seguinte. Painéis de carregamento/falha permitem rolagem desde o início. Os testes matemáticos de viewport verificam o retângulo 16×26 de todos os frames. No passe Blender v2, 760.800 raios cobrem a união de 317 pixels opacos dos sete frames (idle e seis de caminhada), cinco amostras por pixel, ambos os lados e 240 posições de rota; não houve oclusão de cabeça, rosto, corpo ou pés. Os 720 probes de apoio passaram, e 16 meshes de caminhada mantêm vértices, faces, transforms e modificadores exatos. Esse é um audit geométrico estático com todas as silhuetas, distinto do QA de movimento, foco, CSS e recorte no navegador. Dispositivos físicos e calibração humana continuam verificações separadas.

As provas e logs ficam fora da árvore de produção; esta entrega não publica nem altera o jogo principal.
