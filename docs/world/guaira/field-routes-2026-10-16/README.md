# Caminhos do arrozal — 16/10/2026

Continuação da revisão de level design de Guaíra. [Comparações, vídeos e capítulo](index.html).

## Decisões implementadas

- Travessia: margem inicial preenchida; os dois blocos centrais suspensos viraram
  passarelas de inspeção com a mesma altura de chegada, passagem contínua por
  baixo e estrutura de madeira atrás de Feka. Degrau sólido de 16 px em x944–976
  conecta piso256 e margem224. Uma moeda foi reposicionada para esse degrau;
  continuam 21 moedas ao todo, todas opcionais.
- Travessia: câmera antecipa as margens das duas pontes e o piso inferior antes
  da descida. Distâncias horizontais interpoladas; capacete inteiro protegido.
  Instrução da placa no HUD, aviso de checkpoint ocultado somente durante a
  pintura, preservando timer, bandeira, áudio, estado e restauração nativos.
- Respiros: passarela736–768/y160, 16 px acima do envelope máximo de C;
  mirante800–848/y240, totalmente dentro da ilha seca antes de D. Dois prêmios
  opcionais, totalizando sete moedas. Piso, jatos, fases, períodos e vínculo
  registroC→jatoC permanecem nativos.
- Respiros: enquadramento mostra o próximo apoio antes da partida, transições
  verticais suaves e proteção de todo o capacete. A/B/C/D junto aos manômetros
  relacionam o comando C à grelha correspondente. HUD e texto do capítulo
  distinguem registro, passarela e observação de D. Tablados compartilham a
  madeira, bordas e ferragens usados na Travessia.

## Evidências

Resultado final: 996 testes de Guaíra aprovados, sem falhas. Build, validadores e
TypeScript aprovados. Revisão visual conferida em 1440, 844, 390 e 320 px, com
as quatro comparações, todas as imagens e os dois vídeos carregados.

As cinco fontes anteriores estão em `baseline-source/`, copiadas do estado de
trabalho antes desta rodada. Não se usa HEAD como falsa versão anterior.

`detail-verification.json` registra SHA-256 das cinco fontes antigas e atuais,
quatro pares capturados com os mesmos comandos desde o spawn e duas rotas
completas com câmera nativa. Não há reposicionamento de ator, alteração do relógio,
teleporte, edição de colisão ou conclusão forçada nesses percursos.

Travessia: 1.078 atualizações, conclusão na 1.021, 14 moedas; apoios usados em
y208/256/240/224/192. Respiros: 1.134 atualizações, conclusão na 1.114, sete moedas;
apoios em y288/240/192/160/304. Captura a 15 fps, reprodução a 15 fps, simulação
a 60 Hz. As durações são de comandos ensaiados, não estimativas de primeira partida.

`native-browser-verification.json` contém os dois percursos no capítulo real,
teclado do Edge, textos contextuais e continuação aceita para o mapa. Somente
o agendamento de frames é controlado. `browser-verification.json` cobre entrada,
pausa, pintura sem mutação, estabilidade do canvas e retorno nas oito cenas.
As pausas de Respiros e Alívio foram feitas durante a descarga da água.

Os 17 testes novos conferem teclado/toque × normal/reduzido, visibilidade dos
destinos, continuidade da câmera, saltos curtos com recuperação, retorno sem
capacete, restauração e os dois saltos sobre C ativo em 252 fases de partida.
Três testes antigos de orientação foram atualizados para exigir a instrução
compacta no HUD, em vez da faixa removida. Os demais percursos anteriores
continuam cobertos, inclusive a solução dos Respiros só pelo piso.

## Reprodução

Na raiz do projeto:

```powershell
node --import tsx --test tests/guaira-field-routes.test.ts tests/guaira-traversal-guidance.test.ts
$guairaTests = @(rg --files tests -g 'guaira-*.test.ts')
node --import tsx --test @guairaTests
npm run build
```

Captura do renderizador, fornecendo um caminho para `@napi-rs/canvas/index.js`:

```powershell
node --import tsx scripts/prove_guaira_field_routes.ts output/guaira/field-routes-2026-10-16/capture CAMINHO_CANVAS docs/world/guaira/field-routes-2026-10-16/baseline-source
```

Com Vite ativo e Playwright disponível em `PLAYWRIGHT_MODULE`:

```powershell
node scripts/verify_guaira_field_routes.cjs
$env:GUAIRA_OUTPUT='output/guaira/field-routes-2026-10-16/browser-smoke'
node scripts/verify_guaira_level_finish.cjs
```

## Leitura de game design

A exploração passa a produzir trajetos distintos e retornos locais. A passarela
alta oferece domínio dos saltos; isolar C acrescenta tolerância ao erro. D exige
reaplicar a leitura temporal depois do reencontro com a rota principal.

Ainda não houve teste com jogadores externos. Observar: percepção da descida do
arrozal; compreensão de que C não desliga D; escolha entre fechar C e saltar sobre
ele; quedas recuperadas; tempo parado sem entender o próximo passo; vontade de
repetir cada percurso. Os testes automatizados comprovam execução e invariantes,
não substituem essas observações de diversão e dificuldade.
