# Guaíra: contrato do modelo de sessão

`GuairaChapterSession` é um dono de jornada exclusivamente em memória, sem
dependência de DOM, relógio, URL, armazenamento, `WorldGame` ou tipos da campanha.
O módulo não inicia cenas, altera física, concede capacetes, restaura checkpoints
nem persiste qualquer estado. Construir uma sessão sempre começa sem recibos.

## Rota e identidade

A abertura padrão é `guaira-travessia`. A opção explícita
`{ opening: 'guaira-patio-comportas' }` substitui somente a abertura. Os demais
trechos são `guaira-respiros`, `guaira-lab`, `guaira-subida` e
`guaira-prefeito`, nessa ordem. Um resultado de Pátio continua identificado como
Pátio; não concede conclusão fictícia de Travessia.

O mapa do capítulo permite selecionar o próximo recomendado ou repetir um trecho
com recibo aceito. Links experimentais livres permanecem fora deste modelo.
`nextRecommendedScene` é o primeiro trecho da rota ainda sem recibo; vale `null`
após os cinco. `chapterComplete` depende dos cinco recibos, inclusive Respiros e
Subida; liberar água sem essa rota não é um caminho alternativo de conclusão.

## API para o host

```ts
const session = new GuairaChapterSession();
const mapSnapshot = session.snapshot();

// A escolha na JORNADA invalida os botões do mapa anterior, sem iniciar cena.
const selected = session.selectScene('guaira-travessia', mapSnapshot.generation);
if (!selected) return;

// O host caminha até o marco e só oferece ENTRAR depois da chegada real.
// A chegada física pertence ao mapa, não ao modelo de sessão.
const attempt = session.enterScene(selected.selectedScene, selected.generation);
if (!attempt) return;

// O host monta uma única cena nativa, carregada desde seu início normal.
// Cada handler captura esse attempt, não uma variável global sempre atualizada.
const live = adapter.readLiveResult(attempt);
const transition = session.continueFrom(attempt, live);
if (!transition) return;

// transition já aposentou a tentativa: encerrar o runtime antes de montar mapa.
// A seleção aponta ao próximo recomendado; isso não cria outra tentativa.
renderMap(transition.snapshot);
```

- `snapshot()` devolve geração, abertura, rota, recibos, seleção, tentativa ativa,
  próximo recomendado, conclusão e estado descartado. Todos são imutáveis; um
  snapshot antigo continua sendo histórico e nunca muda por referência.
- `canSelectScene(scene, generation)` e `selectScene(scene, generation)` operam
  apenas no mapa. Até repetir a seleção atual troca a geração, invalidando a ação
  contextual anterior. Selecionar não cria tentativa nem resultado.
- `canEnterScene(scene, generation)` exige a seleção atual. O host acrescenta o
  teste de chegada física; `enterScene` devolve a nova tentativa ou `null`.
- `canContinue(attempt, live)` só verifica prontidão, sem guardar um resultado
  pendente. Use uma amostra nova no clique; o estado exibido antes não é evidência
  para aceitar depois.
- `continueFrom(attempt, live)` aceita somente conclusão viva em `playing`,
  aposenta a tentativa e devolve recomendação. Não monta a próxima cena.
- `exitToMap(attempt, live)` aceita conclusão viva em `playing` ou `paused`.
  Pausa não apaga uma vitória legítima, mas mantém Continue indisponível.
  Saída sem conclusão, durante morte ou em outro estado abandona a tentativa sem
  recibo. Se aceitar uma conclusão nova, seleciona o próximo recomendado. Senão,
  preserva a cena selecionada. A posição física no mapa continua sendo do host.
- `retry(attempt)` invalida a tentativa anterior imediatamente e devolve outra
  geração. Chame antes de reiniciar/carregar a cena e religar seus handlers,
  inclusive para uma recuperação nativa que recrie a cena. O modelo não escolhe
  entre reset completo e recuperação por checkpoint; isso permanece nativo.
- `restartChapter(generation, options?)` é uma ação diferente: fecha o modelo
  antigo e devolve um novo vazio. Mantém a abertura se não houver outra escolha
  explícita. Trocar a instância sem descartar a antiga não é o fluxo suportado.
- `dispose()` fecha o modelo uma vez, aposenta a tentativa e bloqueia todas as
  mutações futuras. Recibos antigos permanecem somente para inspeção.

Toda ação com token errado ou aposentado devolve `null`, ou `false` nas consultas,
sem alterar a sessão. Isso inclui clique duplo, seleção antiga, resultado de outro
trecho, tentativa anterior ao retry, sessão anterior ao restart e descarte.

## Adaptadores de resultado

O host fornece `GuairaChapterLiveResult`:

```ts
{
  attempt,                       // token capturado na montagem/último retry
  state: game.state,              // estado nativo lido no clique
  alive: !game.player.data.isDead,
  result: null                    // até o predicado real da cena ficar verdadeiro
}
```

Quando completo, `result` é um dos seguintes valores:

| Cena real | Predicado do adaptador | Resultado tipado |
| --- | --- | --- |
| Travessia, Pátio, Respiros ou Subida | `finished` da própria cena | `{ sceneId, kind: 'reached-finish' }` |
| Ossabravo, `guaira-lab` | encontro real derrotado | `{ sceneId: 'guaira-lab', kind: 'defeated-bull' }` |
| Prefeito, `guaira-prefeito` | `mayor.publicWaterOpen` | `{ sceneId: 'guaira-prefeito', kind: 'mayor-water-released' }` |

O modelo confere identidade e tipo, mas não inspeciona um jogo ou autentica a
origem da amostra. É responsabilidade do adaptador ler esses predicados reais
no momento da ação. Não mapear `at`, `visit`, checkpoint, lacres parcialmente
removidos, posição na Casa ou `boss.phase === 'rest'` para conclusão. O Prefeito
usa `rest` mesmo após liberar água; a Subida não libera a água do bairro.

Não reaproveitar um objeto `live` guardado ao habilitar um botão. Em particular,
retry deve trocar o token antes do reset nativo, e handlers antigos devem manter
o token antigo para que falhem, sem ler uma variável que ganhou a nova geração.
Deixar e reentrar monta a cena no início normal; checkpoint, equipamento,
cronômetro e dano parcial não são campos desta sessão.

## Replay e fronteira de validação

Um replay concluído devolve o primeiro recibo e `newlyAccepted: false`. Retry,
morte ou abandono do replay não removem esse recibo nem a conclusão do capítulo.
`acceptedVia` e a tentativa registrados continuam os da primeira aceitação.
Uma saída abandonada devolve `receipt: null`.

Os testes focados cobrem as duas rotas de cinco trechos, resultados reais tipados,
distinção de selecionar/entrar, pausa, morte, checkpoint sem conclusão, replay,
restart, descarte, resultado incompatível e tempestades de callbacks atrasados.
São testes do modelo puro; não comprovam os adaptadores, chegada física no mapa,
limpeza de runtimes, input/áudio ou uma jornada jogada no navegador.

```sh
node --import tsx --test tests/guaira-chapter-session.test.ts
npm run typecheck
```
