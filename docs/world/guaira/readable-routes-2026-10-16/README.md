# Guaíra — percursos e leitura pela câmera

Revisão de 16/10/2026. [Comparações e vídeos](index.html).

## Problemas tratados

A Subida oferecia um piso de recuperação cujo primeiro canal só devolvia à
entrada, uma espera no elevador com pouca participação e uma travessia superior
sem um alvo intermediário opcional. O piso seco aparecia tarde na aproximação;
o aviso de checkpoint cobria a área de embarque.

Na Galeria, o depósito opcional terminava na mesma abertura pela qual se entrava.
A interface do capítulo ignorava suas orientações locais. O enquadramento de
alguns saltos protegia o corpo, mas deixava parte do capacete sob o HUD.

## Percursos implementados

| Trecho | Decisão | Consequência e recuperação |
| --- | --- | --- |
| Primeiro canal da Subida | Viajar pela prancha ou explorar o piso seco | Novo degrau x448–496/y336 liga o canal à margem seguinte. Os dois lados continuam acessíveis. |
| Embarque no elevador | Usar a entrada baixa ou subir à sacada x592–656/y256 | A sacada oferece duas moedas, permite observar o destino e embarcar em outra altura. Não muda o ciclo do elevador. |
| Travessia superior | Permanecer no veículo, transferir ao mirante x960–1008/y96 ou seguir pela galeria inferior | O mirante tem duas moedas e um salto em direção à Casa. Saltos curtos que não chegam à margem podem usar o degrau direito em y192. |
| Oficina da Galeria | Seguir no piso ou abrir a tampa opcional | A passagem inferior se estende até x352. Dois tablados x320–352/y320 e y288 retornam junto à bandeira, antes da tampa II. |
| Progressão na Galeria | Tampa I → possível exploração → tampa II → subida | Marcação I/II, orientação contextual e continuidade visual dos patamares. As duas tampas obrigatórias continuam definindo a conclusão. |

Não foram criados controles ou regras de colisão especiais. Os apoios novos são
tiles unidirecionais nativos. O salto variável, o transporte dos veículos, a
sentada, as moedas, a restauração e a continuação do capítulo usam os sistemas
existentes. Os dez colecionáveis da Subida e os cinco da Galeria são opcionais.

## Enquadramento e arte

A câmera da Subida antecipa o piso inferior antes da primeira margem. Na sacada,
mostra o destino do elevador; na aproximação superior, revela o mirante e suas
moedas, mantendo o degrau de recuperação à direita visível. A profundidade toda
não cabe simultaneamente na resolução lógica de 320 × 180: cada decisão mostra
os próximos apoios, e a câmera acompanha a descida à galeria quando necessária.

O deslocamento vertical normal é suavizado, com limite de seis pixels por
atualização; a proteção da cabeça e dos pés tem prioridade durante saltos e
quedas. No percurso capturado, o maior passo vertical foi 6,7 px na Subida e
8 px na Galeria. O ponto conservador dez pixels acima do corpo permaneceu pelo
menos 26 px abaixo do topo, fora do HUD de 23 px.

O toast de checkpoint da Subida é suprimido apenas durante a renderização;
bandeira, som, checkpoint e orientação continuam funcionando. A Galeria usa
36 px de margem acima do corpo, incluindo os saltos antes de quebrar tampas.
O capítulo agora transmite as instruções locais da Galeria à sua interface,
como já fazia com outros trechos; pausa, morte e conclusão continuam prioritárias.

Madeira, escoras, alvenaria, entalhes e etiquetas foram feitos no renderizador
de pixel art. Apenas os tiles e corpos físicos recebem bordas claras de apoio.
A passagem inferior é um recorte contínuo, com espaço de saída visível.

## Evidências

- [Comparações e percursos](detail-verification.json): quatro pares capturados
  após os mesmos comandos, sem poses preparadas, e dois percursos completos.
  As referências são os sete arquivos preservados em `baseline-source/`,
  incluindo alterações locais anteriores à rodada. Não são cópias de HEAD.
- Subida: 1.174 atualizações; conclusão na 1.173; sete moedas; dois checkpoints;
  canal, sacada, elevador, prancha, mirante e margem final.
- Galeria: 759 atualizações; conclusão na 751; cinco moedas; oficina, ambos os
  tablados de saída, checkpoint, segunda tampa e patamar final.
- [Capítulo real](native-browser-verification.json): teclado em Edge isolado,
  com agendador da simulação conduzido a 60 Hz. O personagem, a câmera, os
  mecanismos, o relógio e a conclusão não são editados. Verifica também os
  textos contextuais e a continuação: Subida → mapa, Galeria → Alívio → mapa.
- [Oito cenas](browser-verification.json): entrada por teclado, renderização
  sem mutação, pausa estável, tamanho do canvas e retorno; viewport 844 × 390.
- Suíte ampla: 977 testes aprovados. Após a integração do texto da Galeria,
  152 testes direcionados aprovados; dois deles são novos. Ao todo, esta rodada
  adiciona 18 testes. Build, TypeScript e validadores aprovados.
- Três variações do salto que erra a transferência do mirante; três durações
  de salto na saída da oficina sem capacete; pausa, retomada, morte, coleta
  preservada e reinício; execução por teclado/toque e movimento normal/reduzido.

As contagens de atualização e durações são de comandos ensaiados. Não medem
tempo de descoberta, taxa de quadros do navegador ou experiência em dispositivo
físico. Não houve sessão com jogadores externos. Para avaliar diversão e
dificuldade, ainda é necessário observar descoberta das rotas, leitura das
aterrissagens, tempo parado no elevador, erros recuperados e vontade de repetir.

## Reprodução

Na raiz do projeto, com o servidor local em execução:

```powershell
$guairaTests = @(rg --files tests -g 'guaira-*.test.ts')
node --import tsx --test @guairaTests
npm run build

node --import tsx scripts/prove_guaira_readable_routes.ts `
  output/guaira/readable-routes-2026-10-16 `
  CAMINHO_ABSOLUTO_DO_MODULO_NAPI_CANVAS `
  docs/world/guaira/readable-routes-2026-10-16/baseline-source

$env:PLAYWRIGHT_MODULE = 'CAMINHO_ABSOLUTO_DO_MODULO_PLAYWRIGHT'
node scripts/verify_guaira_readable_routes.cjs
$env:GUAIRA_OUTPUT = 'output/guaira/readable-routes-2026-10-16/browser-smoke'
node scripts/verify_guaira_level_finish.cjs
```

Os comandos estão em `tests/helpers/guairaReadableRoutesReplays.json`.
Os frames são renderizados a cada quatro passos da simulação, para vídeos de
15 fps; escala por vizinho mais próximo de 320 × 180 para 960 × 540. Os logs de
teste e build ficam em `output/guaira/readable-routes-2026-10-16/`.
