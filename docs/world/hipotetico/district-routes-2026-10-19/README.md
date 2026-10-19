# Quatro pátios, quatro maneiras de atravessar

Revisão de 19/10/2026 do trecho dos inimigos secundários. As mudanças estão no encontro nativo: `/?encounter=hipotetico`.

## Diagnóstico e intervenção

O trecho já tinha quatro guarnições e portões físicos, mas repetia a mesma estrada com pequenas plataformas. A decoração explicava pouco a função do primeiro plano e a evolução depois de cada vitória se concentrava no portão.

| Pátio | Alteração do percurso | Construção e ambiente |
| --- | --- | --- |
| Portaria | Cobertura intermediária em x452/y144: a plataforma de entrada em y184 permite subir 40 px e atacar o blindado por cima. Duas moedas sinalizam o desvio. | Posto aberto com mãos-francesas, placa, armários de inspeção, corda enrolada e bases de apoio. |
| Cais | O apoio central foi substituído por um monta-cargas entre y196 e y148. Ciclo de 4,6 s, pausas de 650 ms nas duas extremidades, aceleração e frenagem de 300 ms. | Guias fixadas ao piso, roldana, corrente, contrapeso com deslocamento 1:1, caixas, amarrações e canal sob a borda da estrada. |
| Arsenal | Galeria x1308/y132 entre as sacadas dos lançadores. A subida de 28 px a partir da sacada esquerda cria outra aproximação; duas moedas indicam a alternativa. | Ventilador, tubulação, manômetro, mangueiras suspensas e articulações sob a galeria. |
| Bastião | Mantidos os quatro apoios e o corredor central usados pelas investidas e contragolpes da Vanguarda. | Contrafortes junto aos flancos e placas embutidas no piso; a decoração deixa livre a área de duelo. |

Os novos apoios são corpos `support` de mão única. O monta-cargas usa `lift`, `WorldObjects`, `WorldLevel.transport` e o perfil de movimento do motor da campanha. O desenho usa a posição física do corpo. A estrada continua acessível por baixo; nenhuma rota exige esperar pelo elevador para avançar.

## Leitura e passagem do tempo

- Cada pátio tem uma placa numérica discreta e um sinal junto à saída: espera, combate e liberação.
- As correntes e a roldana acompanham o deslocamento do elevador, inclusive a inversão de sentido e as paradas.
- Ao limpar o Arsenal, o ventilador desacelera durante três segundos, o ponteiro cai e o vapor cessa. A posição final permanece estável mesmo após o limite do relógio de assentamento.
- A liberação solta um pequeno sopro perto da máquina do portão. O efeito termina; não reinicia a cada renderização. O papel da Portaria cai uma vez e permanece no piso.
- Retomar um checkpoint inicializa as áreas concluídas no estado assentado.
- Barris perigosos passaram para a frente das estruturas decorativas na ordem de desenho, preservando sua silhueta durante o combate.
- A dica do monta-cargas aparece perto dele e cede prioridade aos avisos de ataque.
- Movimento reduzido desativa a animação decorativa adicionada; deslocamento físico do elevador continua visível.

## Material de autoria e limites

`scripts/render_hypothetical_districts.ts` produz imagens com o renderizador de produção. Posições, câmera e momento de liberação são escolhidos explicitamente. `compositions.json` registra os enquadramentos. O vídeo de oito segundos mostra somente cenário e mecanismos, com liberação dirigida aos dois segundos. Não é uma partida, prova de alcance, avaliação de dificuldade ou teste automatizado.

Esta rodada revisou a geometria a partir das coordenadas e dos parâmetros de salto do motor e refinou as composições nativas. O balanceamento das novas opções ainda requer observação em partidas. Conforme `AGENTS.md`, a publicação executa somente o build de produção, sem testes, typecheck ou revisão de navegador.

Autoria:

```powershell
node --import tsx scripts/render_hypothetical_districts.ts .tmp/siege-districts-final C:/Users/fabio/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas/index.js --motion
```
