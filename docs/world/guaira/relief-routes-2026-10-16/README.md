# Câmara de Alívio — percurso da oficina, 16/10/2026

[Comparações, vídeos e capítulo](index.html).

## Decisões implementadas

- A câmera da plataforma intermediária mostrava o piso e cortava a tampa que
  era o próximo objetivo. Agora mostra a tampa enquanto está intacta e acompanha
  o piso depois da abertura. O capacete inteiro permanece abaixo do HUD.
- A oficina continua pela passarela x320–384/y160 e pela sacada x512–592/y160.
  A mesma altura mantém o destino visível durante todo o salto nativo. São
  plataformas de madeira unidirecionais, com escoras de parede na arte.
- O patamar x624–672/y256 divide a volta ao piso y336. A sala foi ampliada de
  640 para 736 px para acomodar essa saída. A conclusão continua reconhecendo
  o piso a partir de x592; os trajetos anteriores pelo chão permanecem válidos.
- Duas moedas opcionais, totalizando cinco. Abrir a tampa torna a queda segura;
  conservá-la permite cumprir o objetivo existente pela corrida e salto. O
  intervalo seco continua sendo outra solução sem exigir coleta ou desvio.
- Janela voltada ao arrozal, alvenaria, escoras e placas acompanham os apoios.
  Indicações da tampa, salto, sacada e saída usam o HUD e o status do capítulo.
  A água, sua pressão, a abertura parcial e o retorno lateral conservam a
  autoridade física nativa.

## Evidências

Resultado final: 1.011 testes de Guaíra aprovados, sem falhas. Build, validadores
e TypeScript aprovados. Os percursos e controles da continuação também passaram
no capítulo real em Edge.

As quatro fontes anteriores estão em `baseline-source/`, copiadas do estado
de trabalho antes desta rodada. `detail-verification.json` contém seus hashes
e os das fontes atuais, três comparações com os mesmos comandos desde o spawn
e dois percursos completos. Não há teleporte, relógio alterado, colisão editada
ou conclusão forçada nas gravações.

Tampa intacta: 613 atualizações, chegada na 590; alívio aberto: 601 atualizações,
chegada na 574. Ambos coletam cinco moedas e terminam sem dano. Nos dois, o topo
do capacete fica a pelo menos 26 px da borda superior e os pés não passam de
168 px. Deslocamento vertical máximo da câmera: 6,7 px por atualização.

As durações são de comandos ensaiados. Simulação a 60 Hz e captura a 15 fps;
não representam o tempo de uma primeira partida. Os 15 testes novos conferem
teclado/toque simulado × movimento normal/reduzido, as duas travessias, destinos
visíveis durante os saltos, 252 fases de partida, oito impulsos e três durações
do salto, quatro quedas recuperáveis, retorno, pausa e reconstrução.

`native-browser-verification.json` registra Galeria → Alívio aberto → Outra rota
→ tampa intacta → Pausa/Opções/Recomeçar → intervalo seco → mapa, com teclado do
Edge e o agendamento de frames controlado. O objetivo opcional continua valendo
depois de Recomeçar. `browser-verification.json` cobre entrada, pausa, pintura
sem mutação, estabilidade da janela e retorno nas oito cenas do capítulo.

## Reprodução

Na raiz do projeto:

```powershell
node --import tsx --test tests/guaira-relief-routes.test.ts tests/guaira-relief.test.ts
$guairaTests = @(rg --files tests -g 'guaira-*.test.ts')
node --import tsx --test @guairaTests
npm run build
```

Captura, com um caminho para `@napi-rs/canvas/index.js`:

```powershell
node --import tsx scripts/prove_guaira_relief_routes.ts output/guaira/relief-routes-2026-10-16/proof CAMINHO_CANVAS docs/world/guaira/relief-routes-2026-10-16/baseline-source
```

Com Vite ativo e Playwright disponível em `PLAYWRIGHT_MODULE`:

```powershell
node scripts/verify_guaira_relief_routes.cjs
$env:GUAIRA_OUTPUT='output/guaira/relief-routes-2026-10-16/browser-smoke'
node scripts/verify_guaira_level_finish.cjs
```

## Próxima avaliação com jogadores

Observar se encontram a tampa, percebem que abrir o alívio protege uma queda,
entendem a corrida antes do vão e usam o patamar para descer. Medir tentativas,
recuos, tempo sem entender o destino e vontade de experimentar outra rota.
Essas observações ainda são necessárias para avaliar diversão e dificuldade
além das verificações de execução e clareza espacial.
