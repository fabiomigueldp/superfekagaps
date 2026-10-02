# Guaíra · Pátio das Comportas

Protótipo jogável isolado de uma junção de manutenção entre o bairro seco e o arrozal. Um único abastecimento de água limpa dá suporte a um de dois tabuleiros. Trocar o ramal levanta um e abaixa o outro. As duas placas operam o mesmo seletor e aceitam a sentada normal de Feka.

Não há simulação de fluidos, nado, combate, contagem regressiva ou dano necessário. O suco roxo não ganha explicação nova. Os trabalhadores permanecem personagens amistosos, com as mesmas artes de trabalho já usadas em Guaíra.

## Contrato de jogo

1. Feka começa no bairro, em `(48,304)` com capacete. O abastecimento inicial está em B; A está atracado no piso seco.
2. A placa da entrada, `x160..192`, troca o pedido para A. Há 400 ms de aviso visual antes da troca de alimentação. Não existe prazo para aproveitar a mudança.
3. A sobe de `y400` para `y256`. Feka pode embarcar durante a subida ou esperar e saltar. Soltar a direção deixa o transporte nativo levá-lo.
4. O patamar central `x384..576, y256` contém a bandeira em `x432` e uma segunda placa em `x480..512`. A bandeira é um checkpoint nativo desta tentativa.
5. A segunda sentada pede B: A desce e B sobe de `y400` para `y208`. A troca é reversível, inclusive durante o movimento dos tabuleiros.
6. Feka chega ao arrozal e conclui ao estar apoiado em `y208`, com `x >= 880`, checkpoint alcançado, alimentação B e nenhum desvio pendente. Não precisa esperar o tabuleiro vazio terminar o movimento atrás dele.

Os tabuleiros têm 160×8 px. `WorldObjects.update`, `WorldLevel.transport`, `WorldLevel.resolveCollision`, `Player` e `Input` continuam responsáveis por todo deslocamento, transporte, colisão, pulo, sentada e toque. O adaptador local apenas observa as placas, mantém a exclusividade A/B e escolhe o destino dos dois elevadores nativos `gated`.

As docas inferiores ficam niveladas no piso seco (`y400`). Isso é deliberado: uma doca antiga em `y368` permitia atingir, por baixo, a tolerância de 24 px do checkpoint nativo. O piso nivelado remove o apoio falso sem alterar o checkpoint global nem introduzir filtros temporários nos dados da fase.

## Recuperação e interrupções

- Uma queda de qualquer tabuleiro cai no piso seco contínuo. É possível voltar à esquerda e saltar pelo degrau de `y352` até a entrada de `y304`, com física e controles normais
- Pausa, perda de foco e aba oculta congelam aviso, alimentação, movimento e transporte; o Input nativo limpa os comandos segurados
- Uma morte usa o reinício nativo. Antes da bandeira, volta ao bairro com B alimentado; depois dela, volta à bandeira com A estabilizado em cima e B atracado
- Recomeçar chama `load(id)` e limpa checkpoint, seletor, relógio, conclusão e comando segurado desta tentativa
- `returnToSafePoint()` é uma operação de reconstrução local usada na prova e disponível ao chamador; não exige nem propõe um quarto botão permanente
- Ao concluir, Feka fica apoiado e parado em idle; tempo, objetos e resultado ficam fixos. Pausa e mute continuam funcionais
- Movimento reduzido remove poeira, impacto, tremor e animações decorativas. Os elevadores continuam se movendo, pois seu deslocamento é parte da mecânica; letras, vidros de inspeção, setas e texto continuam indicando os estados

## Integração opcional

Os módulos da fase usam Player e mecanismos nativos, sem alterar campanha, saves, `WorldGame` ou `WorldPhysics`. O construtor `new GuairaJunction(canvas, status)` usa armazenamento efêmero e não consulta `localStorage`.

A rota opcional `/guaira-patio.html` tem ação secundária PATIO apenas no início da maquete. A ação principal Travessia permanece. A interface tem PAUSA, TENTAR e MAPA; ao concluir, CURRAL substitui PAUSA e oferece a arena explicitamente. Pausar restaura CONTINUAR nesse espaço. O teclado usa o Input nativo; aparelhos com Pointer Events e toque usam a barra bitmap local de44px, com o canvas original como fallback.

`mapReturnHref` entrega:

- Antes da conclusão, inclusive com checkpoint: `./guaira.html?at=town`
- Depois da conclusão: `./guaira.html?at=rice&visit=junction-clear`

O parâmetro `junction-clear` é um resumo de visita validado pelo helper do mapa. Não escreve progresso persistente nem registra conclusão de campanha. A entrada sincroniza o link no clique, bloqueia continuação atrasada após pausa/retry e mantém rótulos acessíveis nos três controles visíveis.

## Prova reproduzível

```sh
node --import tsx --test tests/guaira-junction.test.ts
node --import tsx scripts/prove_guaira_junction.ts /tmp/guaira-junction-proof
```

O replay congelado usa eventos reais do `Input` de teclado e toque, sem reposicionar Feka, fabricar sentadas ou invocar botões diretamente durante a conclusão. São 893 frames a 60 Hz (~14,9 s de gravação), duas sentadas, sem corrida, moedas, dano ou morte. Feka é carregado em movimento por A durante 119 frames e por B durante 152 frames.

A prova cobre reversão repetida, salto comum que não aciona a placa, queda e recuperação em ambos os trechos, reinício antes/depois da bandeira, pausa/blur/aba oculta durante aviso e deslocamento, cancelamento de toque, repetição da partida, redução de movimento e o salto habilidoso que conclui antes de B parar.

Uma revisão independente também varreu 744 saltos corridos a partir das docas: nenhuma aproximação ou captura indevida da bandeira e nenhum dano. Testou dez sentadas consecutivas sem esperar estabilização, dezoito saídas durante movimento de B com recuperação natural, e embarque de volta em A descendo.

O script gera `proof.json`, uma galeria `index.html` e SVGs dos comandos do pintor Canvas real, incluindo câmera, sprites, HUD e controles de toque. O DOM e o áudio são substituídos só nas fronteiras de execução. São provas offline, não capturas de navegador, testes em celular nem medidas de FPS. Nenhum navegador foi utilizado nesta tarefa.

Os arquivos visuais são gerados fora do pacote e não entram na publicação. Não foram adicionadas dependências, texturas ou assets de runtime. O build existente, com o helper de retorno atualizado, mantém 40.373.043 bytes em 115 arquivos, abaixo do limite de 45.000.000 bytes; a entrada opcional ainda não está incluída nesse número e deve ser medida na integração. Um bundle independente do módulo novo com toda a engine nativa também compila: 361.604 bytes minificados, 121.199 bytes em gzip, sem dependências externas.

## Validação neste checkout

`npm run check` para no launcher do `tsx`, porque seu socket IPC local é negado neste ambiente. A mesma suíte foi executada por `node --import tsx --test`, seguida dos testes `.mjs`: 818 testes TypeScript e 3 JavaScript passaram. Os 14 testes focados do Pátio também passaram novamente após a atualização do helper. Validações de níveis/assets/world, os dois projetos de TypeScript, build Vite e orçamento do build passaram por seus comandos equivalentes. A revisão final deve registrar as contagens atualizadas depois da integração opcional.

Não foram criados commits nem feitas publicações, alterações remotas ou conexões a `ssh oracle` por este protótipo.
