# Guaíra — descargas cruzadas e interrupção, 16/10/2026

O Prefeito da Vazão passa a encadear jatos horizontais antes das carimbadas nas
etapas 2 e 3. Um registro acionado depois do primeiro disparo corta a sequência,
oferecendo uma estratégia de contra-ataque mais rápida, com risco de aproximação.

## Regras jogáveis

- Primeiro lacre: tutorial anterior de carimbada, registro, plataforma e costas.
- Segundo: alto da direita, baixo da esquerda; 46 ticks de aviso por disparo,
  38 de intervalo ativo, velocidade 3,4 px/tick. Se não interrompido, carimbada,
  ondas e pulso da emenda continuam.
- Último: baixo da esquerda, alto da direita, baixo da direita; aviso de 42 ticks,
  intervalo de 34 e velocidade 4 px/tick. Depois, carimbada dupla com dois alvos.
- Cada disparo mantém a direção e altura anunciadas. O aviso não causa dano;
  apenas o contorno sólido do pacote de água faz contato.
- A oportunidade de interromper começa após o primeiro disparo. Exige um novo
  evento do switch nativo, não um registro já ligado. Fecha-se ao começar a
  carimbada seguinte.
- A interrupção limpa os jatos e cancela o resto do combo. Dá recuperação de
  210 ticks, sem pulso da emenda. As costas só abrem quando a plataforma real
  chega ao topo; a sentada não remove lacres por si só.
- Uma abertura perdida inicia outro ciclo. A terceira batida nas costas libera
  a água e entrega o resultado ao capítulo pelo contrato existente.

## Arte e integração

Os bocais traseiros pertencem à arena nativa. Gestos de armar, apontar e disparar
são poses em pixel art, com pés apoiados no patamar. A chave foi reposicionada
após uma verificação detectar invasão do piso em duas poses. O jato tem cinco
faixas de colisão compartilhadas com o desenho, frente curva e reflexos ligados
ao relógio da simulação. Pausa congela tudo; movimento reduzido mantém os sinais
essenciais e fixa o gesto de preparação.

`GuairaMayorLab` continua usando Player, Input, WorldObjects, áudio e câmera
nativos. O capítulo monta a mesma classe. Não houve mudança da física global,
da vida do jogador ou dos recibos de conclusão. Os sons são os existentes:
aviso, descarga, sentada e acionamento do registro, sem duplicar o som do switch.

## Evidência e reprodução

Quatro gravações de comandos ficam em `tests/helpers/guairaMayor*Replay.json`:
balcão, espera da emenda, piso e interrupções. O novo percurso de interrupções
remove os lacres nos frames 407, 690 e 1063; o percurso completo pelo piso, nos
frames 407, 1004 e 1701. Não há posicionamento de personagem, alteração da vida
ou concessão de vitória nos percursos. Capturas são feitas a cada update de
1/60 s, com pintura sem mutação, e exportadas a 60 fps. Vídeos são silenciosos.

```powershell
$guairaTests = @(rg --files tests -g 'guaira-*.test.ts')
node --import tsx --test --test-reporter=tap @guairaTests
npm run build

$env:GUAIRA_MAYOR_PROOF='crosscurrent'
node --import tsx scripts/prove_guaira_mayor_rework.ts OUTPUT CANVAS_MODULE

$env:PLAYWRIGHT_MODULE='ABSOLUTE_PLAYWRIGHT_MODULE'
$env:GUAIRA_OUTPUT='OUTPUT/chapter-browser'
$env:GUAIRA_ASCENT_ROUTE='roof'
node scripts/verify_guaira_chapter_readability.cjs

$env:GUAIRA_OUTPUT='OUTPUT/review-browser'
$env:GUAIRA_MAYOR_EXTRA_ROUTE='tests/helpers/guairaMayorInterruptReplay.json'
$env:GUAIRA_MAYOR_REVIEW_PATH='/docs/world/guaira/mayor-crosscurrent-2026-10-16/index.html'
$env:GUAIRA_MAYOR_VIDEO_COUNT='5'
node scripts/verify_guaira_mayor_rework.cjs
```

Os JSON desta pasta registram testes, compilação, quatro capturas completas,
percursos no capítulo e controles no navegador. `baseline-source` e a gravação
anterior são preservados; `before.mp4` é o vídeo da rodada anterior, cuja origem
e hashes são conferidos em `baseline-verification.json`.

Limites: rotas ensaiadas não medem diversão ou descoberta por novos jogadores.
Toque usa eventos DOM reais simulados no navegador, sem aparelho físico. Áudio
tem verificação de eventos/ciclo de vida, não avaliação auditiva de mixagem.
