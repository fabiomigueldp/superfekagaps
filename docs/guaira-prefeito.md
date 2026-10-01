# Guaíra: laboratório do Prefeito da Vazão

Encontro experimental isolado em `guaira-prefeito.html`. Prefeito fictício, sem nome pessoal canônico aprovado e sem semelhança pretendida com político real. O objetivo é reabrir o ramal público do bairro. Os três marcadores representam lacres da água, removidos por três interações completas. A faixa roxa é tecido e a água é ciano; este encontro não introduz fruta nem explica o suco roxo.

## Jogar

- Setas ou A/D: mover; Espaço: pular; baixo no ar: sentada; Shift: correr; Esc: pausar; M: som
- Espere o carimbo alto. A moldura amarela marca a grelha exata que soltará água; saia dessa região
- Depois da batida, use a sentada na placa à esquerda. A passarela sobe e o prefeito tenta soltar o carimbo
- Espere o dorso ficar exposto e pule sobre ele. O texto distingue registro fechado, passarela subindo e golpe disponível
- Volte pelo piso seco e repita. Perder uma janela apenas reinicia o ciclo. Depois do terceiro lacre, a água chega ao bairro e Feka continua controlável

O checkpoint local fica na aproximação do registro. Morrer reinicia o encontro inteiro e recupera o capacete que foi guardado ali. “Tentar” reinicia a tentativa. Não há links vindos da campanha ou do mapa, saída de campanha, identificador registrado, esquema de save novo ou acesso ao armazenamento persistente.

## Contrato de simulação

O adapter herda `WorldGame` em modo efêmero. Input, movimento, pulo variável, sentada, transporte, colisão, capacete, morte, checkpoint, toque, pausa e renderização de Feka são os reais. `GuairaMayorModel` controla somente o encontro; não contém um jogador ou física alternativa.

Arena: 320 × 288; piso contínuo em y224; registro 64,216,32,8; lift nativo 112,224,112,8 até y160; deck one-way 224,160,92,8; corpo 264,120,28,40. O dorso atingível é 274,120,14,6 e precisa ser cruzado de cima durante queda. Não há dano lateral do corpo. O único dano é a água da grelha 112,204,112,20, exatamente o retângulo avisado.

FSM em 60 Hz: intro 72 ticks → idle 30 → warning 60 → stamp 24 → recover 270 → idle. Um golpe leva a hurt 45 ou released após o terceiro lacre. O alvo fica fixo desde warning. Só stamp causa dano. A batida fecha tanto o switch quanto o lift, limpa a abertura anterior e libera o debounce para que a próxima sentada abra de fato. Uma nova ativação depois da batida, switch ainda aberto e lift em y160 são necessários para expor o dorso. Fechar o registro de novo retira a abertura e devolve a instrução correta de sentada.

Os 4,5 s de recuperação substituem a hipótese inicial de 1,2 s: só os 64 px de lift levam 70 passos nativos (~1,17 s). A rota congelada usa sentada, embarque/carry, pulo e retorno sem corrida; acerta nos frames 322, 622 e 922, sempre antes do tick 136 de uma janela de 270. Feka termina de volta ao piso no frame 1052, com capacete intacto. A física permite alcançar o deck diretamente do piso, mas essa rota alternativa não elimina a ativação fresca e a abertura legível. Embarcar no lift não é um requisito oculto.

## Câmera e apresentação

A câmera local parte de y64 e acompanha saltos altos sem mudar física, escala ou código global. Usa o topo visual conservador do sprite e capacete (y−4), alvo antecipado, easing contínuo e limite para manter pelo menos 27 px de margem superior. O retorno é suave; a grelha inteira volta ao quadro antes de Feka poder entrar na sua altura. Pausa congela a câmera; movimento reduzido preserva esse seguimento funcional.

O render nativo de Feka permanece ativo. Apenas o painel genérico de HP é omitido, temporariamente retirando o boss durante render com restauração em `finally`; a referência estável do encontro alimenta os pintores. O prefeito é desenhado no pass de objetos, antes de Feka. A barra superior indica água liberada. A pequena dica é omitida quando encobriria o sprite; o mesmo texto permanece no status externo. Aviso, batida, recuperação coberta, dorso exposto e desfecho têm poses próprias.

O problema anterior de enquadramento foi medido com um salto segurado normal sobre o deck: 11 frames totalmente fora do canvas e 22 acima/atrás da barra superior. Depois do ajuste local, o mesmo input tem zero frames ocultos e capacete no mínimo em y27 da tela. Timing, posições físicas e frames dos três golpes permanecem iguais. Há prova separada do salto vertical no centro da passarela, onde a dica precisa desaparecer.

## Verificação e integração

`node --import tsx --test tests/guaira-mayor.test.ts` cobre teclado e toque completos, canto/passividade, janela perdida/repetível, toggle fechado/reaberto, carry descendente sem esmagamento, bordas do dorso, capacete/morte/checkpoint, retry, Escape/blur/visibilidade, pausa, render sem mutações, falha de painter com restauração, pulo curto/segurado e movimento reduzido. São 18 casos focados. Os dois projetos TypeScript passam.

A prova gráfica usa `GuairaMayorLab.render`, `Renderer` e o replay nativo em Skia Canvas offline; não é gravação de navegador. Os PNGs e scripts de prova ficam fora do pacote de produção. A integração ainda deve rodar sua suíte combinada e verificar a entrada no navegador da prévia antes de publicar.

Hunk de Vite reservado ao integrador: adicionar `guairaMayor: 'guaira-prefeito.html'` ao objeto `build.rollupOptions.input`. Um bundle de produção foi validado com esse override programático em diretório temporário, sem editar `vite.config.ts`. Nenhuma publicação, alteração no servidor Oracle ou mudança na campanha faz parte deste laboratório.
