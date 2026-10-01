# Guaíra · Subida da Vazão

Protótipo isolado em `guaira-subida.html`, com `Player`, `WorldGame`, `WorldLevel` e `WorldObjects` reais. Não integra `STAGES`, não cria mundo, não lê nem escreve `localStorage`, não registra placar e não exige vitória na arena. Fechar a página descarta a tentativa.

A sequência é **curral → prancha de inspeção → checkpoint → elevador de serviço → Casa da Vazão**. Movimento e salto bastam. A conclusão mostra o desvio: o cano particular recebe água limpa, enquanto o ramal do bairro permanece fechado. Não significa que a distribuição foi consertada. Mapa e Recomeçar são ações explícitas; não há transição automática.

## Geometria verificada

A planta de partida foi mantida após teste com física real: 1024×400, 16 px por tile. Coordenadas de superfície/pés:

| Superfície | x | y | Movimento |
| --- | --- | --- | --- |
| Curral | 0–224 | 304 | Spawn em x48 |
| Prancha, 80×8 | 240→400 | 304 | `platform`, ciclo nativo de 10 s |
| Recuperação A | 224–496 | 368 | Degrau x240–288/y336 |
| Patamar | 496–656 | 304 | Checkpoint x528 |
| Elevador, 80×8 | 672 | 304→144 | `lift` autônomo, ciclo nativo de 10 s |
| Recuperação B | 656–768 | 368 | Degrau x656–704/y336 |
| Terraço | 768–1024 | 144 | Conclusão após x944, somente no chão |

Os pisos e degraus de recuperação são `TileType.PLATFORM`; patamares são terreno sólido. A água é cenário atrás da borda, sem dano ou colisão. Os dois veículos são a implementação nativa, sem nova física, trava, parada artificial ou acionamento. Cabos, trilhos e decks desenham as posições reais. A câmera nativa mostra a margem de desembarque durante a prancha e o terraço antes do salto do elevador.

## Controles e interrupções

Setas/A D e Espaço, ou os controles de toque existentes. Não é preciso correr, usar sentada ou coletar moedas. As três moedas no piso inferior são opcionais. A barra bitmap tem alvos de 44 px, nomes acessíveis, ativação por teclado e foco devolvido ao canvas ao continuar/recomeçar.

Escape, botão de pausa, ocultação da aba e perda de foco congelam o movimento e limpam entradas. Recomeçar apaga checkpoint, moedas e resultado e repõe ambos os veículos na origem. Morte usa o pipeline nativo: retorna ao início ou ao checkpoint, sempre reconstruindo veículos na posição inicial. Movimento reduzido congela animação decorativa e remove shake/poeira, mantendo movimento funcional dos veículos. Por não haver preferência pública de partículas em `WorldGame`, esse último filtro é um adaptador de apresentação apenas desta instância; não altera a física global.

Na conclusão, Feka fica imediatamente parado e o relógio da tentativa e os mecanismos ficam congelados; sua animação idle continua. O cabeçalho mostra `DESVIO A VISTA`, e uma faixa de uma linha deixa visíveis as placas CASA DA VAZAO, BAIRRO e PARTICULAR e os controles inferiores.

## Retorno ao mapa

- Antes da conclusão: `./guaira.html?at=corral`
- Depois: `./guaira.html?at=vazao`

A segunda URL depende da integração do mapa, feita separadamente: chegada neutra em `guaira-5`, sem seleção automática. A experiência começa no curral; nenhuma seleção da casa se torna portão jogável. O mapa deve preservar os pontos canônicos de `3:4` e as distâncias do curral ao estender a estrada. Este módulo não modifica `GuairaMapModel` ou seu controller.

## Evidência reproduzível

- `node --import tsx --test tests/guaira-ascent.test.ts`: 14 testes. Replay completo por teclado e eventos de toque nativos, sem corrida/sentada/coleta; duas voltas completas parado em cada veículo; quedas à esquerda e à direita de ambos e recuperação; mortes antes/depois do checkpoint; repetição de pausa/retry, blur/hidden, cancelamento do toque, retorno de mapa e isolamento de armazenamento.
- `tests/helpers/guairaAscentReplay.json`: 904 passos fixos de 60 Hz, conclusão em **15,067 s**. É uma rota com timing conhecido; **não** valida a meta de 45–90 s para uma primeira passagem humana. Não foi acrescentada espera artificial para forçar duração.
- `node --import tsx scripts/measure_guaira_ascent.ts`: varre os 600 possíveis frames de partida de um ciclo, usando saltos normais e posições iniciais documentadas no script. Janelas amostradas: embarque prancha **4,283 s**, desembarque prancha **1,917 s**, embarque elevador **6,067 s**, desembarque elevador **5,883 s** por ciclo. São medidas destes inputs/posições, não limites universais de todas as trajetórias.
- `npm run typecheck` e os validadores de níveis, assets do Player e mundos passam. Build Vite validado com a entrada nova fornecida no override local de build; integrar a entrada permanentemente na configuração junto ao mapa.

Provas de render foram geradas executando o replay e chamando `GuairaAscent.render()` com Canvas Skia, incluindo câmera, HUD, resultado, jogador e controles de toque reais. São imagens da implementação, **não capturas de navegador**. O acesso local do navegador recebeu `ERR_BLOCKED_BY_CLIENT`; a revisão visual e navegação no navegador ficam com a integração em prévia. Não chamar esta evidência de teste humano de dificuldade, teste de dispositivo móvel ou teste do deploy.
