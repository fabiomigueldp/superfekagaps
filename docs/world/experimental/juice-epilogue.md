# Turbosuco: epílogo do campeonato

Integrado à página `juice-lab.ts` pela subclasse `JuiceLabHost`. O host mantém
o update de `JuiceMinibossLab` e só substitui a apresentação do resultado após
o pouso real. Não modifica `JuiceMinibossLab`, `GuairaChapterApp`, combate,
física, Input, falas ou áudio.

## Sequência e lore

Após derrotar Turbosuco, Feka volta ao palco e espera reconhecimento. Os jurados
baixam os braços e retomam a expressão neutra. Ele insiste na pose triunfal. O
letreiro mantém **TURBOSUCO DERROTADO!**: a vitória jogada permanece verdadeira,
sem conceder um título de fisiculturismo nem explicar a composição do suco.

| Beat | Duração | Apresentação |
| --- | --- | --- |
| `return` | 800 ms | Corte ao palco existente; breve saída do escuro; Feka vestido, elenco surpreso |
| `boast` | 1.800 ms | Corte fixo em Feka, pose `celebrate` existente |
| `judges` | 2.000 ms | Corte fixo nos jurados, reação `neutral` existente |
| `insist` | 1.800 ms | Plano geral; Feka retoma a pose, jurados continuam neutros |
| `complete` | até ação do usuário | Mesmo quadro final; nenhuma navegação automática |

São 6,4 segundos após a aterrissagem, sujeitos à resolução do update. Movimento
reduzido mantém plano geral e poses estáticas por beat, sem fade ou mudanças de
escala. Não há nova fala, nota, troféu, ingrediente, associação com o prefeito ou
alteração do relacionamento Yasmin/João. Reutiliza `CalabrezzoStageArt` e
`PLAYER_SPRITES`/`PLAYER_PALETTE`; preserva o capacete real da vitória.

## API e contrato do host

`new JuiceEpilogue(lab)` vincula um controlador à instância real. O import do lab
é somente de tipo; o módulo não importa o entrypoint e não cria recursos globais.

- `update(dtMs)`: chamar **depois** do update nativo. Só inicia com `labMode=result`,
  boss `defeated`, vida zero, Feka vivo/no chão e estado `playing`. Aguarda o salto
  de retorno do último acerto. Cada update avança no máximo 100 ms.
- `frame`: snapshot congelado ou `null`. Identidade do boss identifica a tentativa;
  Retry/Replay invalidam o snapshot imediatamente, inclusive antes do próximo
  update. Ler ou pintar não avança relógio.
- `skip()`: retorna `true` apenas durante epílogo ativo e sem pausa; entrega o mesmo
  snapshot final que a conclusão natural. Cliques tardios não afetam nova tentativa.
- `dispose()`: terminal e idempotente. O host deve chamá-lo na saída. A disposição
  do próprio lab também invalida qualquer frame.
- `drawJuiceEpilogue(context, frame, reducedMotion)`: pinta uma cena nativa 320×180;
  o ator é cênico. Não escreve posição, equipamento, estado ou Input do Player.

Integração aplicada em `src/adventure/experimental/JuiceLabHost.ts`:

```ts
// No override de update; o loop e a física são os existentes.
super.update(dt);
this.epilogue.update(dt);
// O override de render consulta this.epilogue.frame. Sem frame, usa
// super.render(); com frame, pinta a cena, a pausa quando necessária
// e apresenta uma vez. addCleanup descarta o controlador na saída.
```

O update nativo de resultado preserva pausa, mute, áudio e aterrissagem. Não há
timer nem RAF adicional: os dois callbacks existentes continuam sendo o jogo e
a atualização da toolbar. O botão nativo `lab-skip` recebe nome acessível
**Pular epílogo** nos quatro beats, fica desabilitado na pausa e some ao concluir.
O foco não muda entre beats; se o botão focado desaparecer ao terminar, volta ao
canvas sem scroll. TENTAR e REVER invalidam o frame e sincronizam os controles
no próprio clique. Espaço no combate não pula o epílogo.

O host registra o descarte no lifecycle existente. A página remove listeners,
cancela o RAF da toolbar e desconecta o ResizeObserver. `pagehide` descarta o lab
na saída definitiva; quando `persisted` indica cache de histórico, mantém a
instância pausada para voltar pelo navegador e continuar explicitamente.
Não há autoplay, callback de voz, timer, save ou desbloqueio. O fim segura o
quadro e mantém as ações existentes; não reinicia a luta sozinho.

## Evidências e limites

`node --import tsx --test tests/juice-epilogue.test.ts` verifica seis acertos via
eventos de teclado no Input real, 942 snapshots iguais com/sem observador,
aterrissagem, pausa, blur/visibilidade, skip, retry, replay e descarte. O harness
usa o constructor, Player e encounter de produção; somente as fronteiras do
navegador são substituídas. Não forja vida zero para obter a vitória.

`scripts/prove_juice_epilogue.ts` reproduz a mesma vitória e compõe pelo Renderer
real. Gera cinco quadros por modo, 385 frames normais e `evidence.json` fora do
repositório/public. Verifica render sem mutação, pintura repetida idêntica,
movimento reduzido estático por beat e equivalência entre skip/fim natural.
O digest entre modos normaliza somente `save.preferences.shake`, que o constructor
nativo desliga deliberadamente no modo reduzido.

```sh
EPILOGUE_CANVAS_MODULE=/caminho/qa/node_modules/@napi-rs/canvas \
  node --import tsx scripts/prove_juice_epilogue.ts /tmp/juice-epilogue-proof
```

Canvas é dependência opcional de QA externa ao projeto; nenhum pacote/runtime
asset foi adicionado. As provas são renderizações offline, não capturas de
navegador. A trilha e os efeitos integrados na base permanecem
intactos; este epílogo não solicita nem gera áudio.

`tests/juice-epilogue-host.test.ts` exercita a subclasse e o entrypoint real:
replay dos seis acertos, snapshots idênticos do combate e de toda a aterrissagem,
render sem mutação, pausa por Escape/blur/visibilidade, movimento reduzido,
conclusão natural e skip, nome acessível, foco estável, retry/replay no mesmo
turno e limpeza terminal dos callbacks e listeners. Junto aos testes existentes
de epílogo e lifecycle, são 26 testes focados. Esse harness substitui apenas as
fronteiras do navegador; a QA visual em navegador real continua sendo uma
verificação separada, e esses testes não afirmam validar toque físico.

Validação histórica do módulo isolado sobre `1fad188374d84b46acfec50bbd5a0753e07171a7`:
102 testes focados do epílogo/introdução/Turbosuco, os dois projetos TypeScript,
os três validadores, build Vite e gate de 45 MB passaram. Output: 155 arquivos,
42.695.227 bytes. Essa medição antecede a integração e não mede seu custo
no bundle integrado. A prova registra 33 updates de aterrissagem após os
942 frames da luta; todos os acertos vêm da gravação de inputs existente.

Na integração do host, o build de produção também passou no Chromium: os seis
acertos foram reproduzidos por eventos DOM de teclado e física nativa a 60 Hz,
seguidos do pouso e epílogo. Pausa, skip com retorno de foco, fim natural, retry,
replay, retorno de bfcache pausado e descarte foram verificados em desktop e
390 × 844 com movimento reduzido. Não houve escrita de vida, posição ou vitória.
A suíte agregada passou com 1328 testes TypeScript e três do servidor; validadores,
ambos os projetos TypeScript, build e limite de tamanho passaram. O build integrado
contém 155 arquivos e 42.729.858 bytes (limite de 45.000.000).
