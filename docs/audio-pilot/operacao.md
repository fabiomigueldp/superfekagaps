# Operação segura e sequência de produção

## Rota ativa: plugin conectado no root

Na atualização final, o root informou que `creative_get_flow_node_types` passou
com o plugin ElevenLabs conectado. Os nós disponíveis incluem Music v2.5 e SFX
v2. Esta sessão verificou seu catálogo de ferramentas e não dispõe desse plugin.
Ela entrega [prompts e parâmetros exatos](handoff-plugin.md) para execução única
no root. **Não executar REST local em paralelo nem pedir outra credencial para
esse caminho conectado.** O root deve aplicar `creative-studio` e o schema atual.

Nenhum áudio foi gerado nesta sessão; nenhum ID/recibo de geração existe.
As instruções de cofre abaixo ficam como referência para uma eventual rota REST
futura explicitamente escolhida. O 403 local não bloqueia o plugin do root.

## O que está autorizado agora

Direção, prompts, auditoria e preparação local. A atualização do usuário autoriza
o piloto usando créditos/saldo já disponíveis, **sem compra, recarga, mudança
de plano ou cobrança adicional**. Não se pede outro teto numérico. O root cuidará
da verificação de quota/custo efetivo pelo plugin conectado. A licença
comercial será tratada pelo usuário; nenhuma autorização de publicação foi
verificada. O código deste pacote não faz requisições, mesmo se existir variável
de credencial no processo.

“Offline” significa produção fora do jogo: preparar, editar, medir e organizar
localmente. A futura geração ElevenLabs precisará de internet via API; não é um
modelo local. O jogo final recebe somente assets aprovados, nunca chave, SDK de
geração ou chamada ElevenLabs em runtime.

## Alternativa REST futura: instrução mínima de segredo

1. Em **Settings → Codex Cloud → Environments → Edit**, configurar um requisito
   **Network secret** chamado `ELEVENLABS_API_KEY`, com destino permitido exato
   `api.elevenlabs.io`. Não criar variável direta nem prefixo `VITE_`.
2. Em **Personal vault → Add**, escolher **Network secret**, a mesma chave e
   fornecer o valor privadamente. Em **Applies to**, selecionar este ambiente.
   Alternativamente, preencher o formulário **Add personal secrets** quando a
   nova tarefa solicitar o requisito. Revisar também a allowlist de rede, pois
   valores pessoais não acrescentam destinos automaticamente.
3. Salvar/republicar **a configuração do ambiente** e abrir **uma nova tarefa**
   usando-a. Informar apenas que o secret foi configurado, sem colar seu valor
   na conversa. Preservar este commit/pacote para a nova tarefa.

Programas recebem um marcador, e o proxy substitui o valor em HTTPS/443 para os
destinos permitidos. A documentação afirma que tarefas existentes conservam seu
estado; um novo turno na mesma tarefa não é garantia de atualização. Não é
necessário criar outro ambiente. [Guia oficial de ambientes e cofre](https://learn.chatgpt.com/docs/environments/cloud-environments#configure-environment-variables-and-network-secrets).

Este fluxo foi confirmado documentalmente, mas o formulário do usuário não foi
operado nem sua configuração verificada nesta tarefa. Não há aqui ferramenta
exposta de instalação de secret no ambiente; variáveis de Sites seriam de outro
produto e não serão usadas.

Após autorização posterior explícita no fio, uma cópia do anexo foi disponibilizada
a um processo local, com permissão 0600. O processo tentou apenas o GET de quota,
sem imprimir a chave. O proxy recusou o túnel (403), antes de chegar à API; a cópia
foi removida em `finally`. Uma sonda sem autenticação confirmou o mesmo bloqueio,
inclusive com permissão adicional de rede. Nenhum valor foi posto no repo ou logs.
O cofre de rede continua sendo o caminho recomendado para retomar a geração.

## Primeira tarefa após a configuração segura

Um executor futuro deve ser implementado/revisado nesta pasta de ferramentas,
sem importação pelo frontend. Nesta entrega há apenas descritores de pedidos.
Antes de habilitá-lo:

1. Confirmar com o usuário que o secret é de rede e pertence à conta correta.
   Não imprimir ambiente, valor, marcador, headers completos ou corpo de erros.
   Manter o proxy e a verificação TLS; não usar `--noproxy`, `-k`, verbose HTTP
   ou diagnóstico que grave requisições.
2. Consultar somente informações de conta/quota necessárias, por uma operação
   de leitura autorizada e sem gerar áudio. O ponto de partida documentado é
   [Get user subscription](https://elevenlabs.io/docs/api-reference/user/subscription/get).
   Seu resultado pode não cobrir todas as cotas de Music/API: não supor que
   `character_limit` seja saldo de música ou que crédito Creative seja USD API.
3. Confirmar plano, unidade, saldo utilizável por produto, cobrança por geração,
   arredondamento/mínimos, entitlement de formato e overage desativado. Se a API
   não comprovar ausência de cobrança adicional, pedir ao usuário confirmação
   do limite no painel. A documentação atual define `max_credit_limit_extension=0`
   como overage desativado; preferir esse campo ao legado
   `allowed_to_extend_character_limit`. Isso não prova sozinho saldo Music.
   Não ativar billing nem alterar plano para desbloquear.
4. Calcular limite superior por pedido conforme a conta e reservar o saldo
   necessário ao lote restante. Concorrência 1; zero retry automático. Timeout
   ou resposta perdida pode já ter sido cobrado: registrar `charge_unknown` e
   reconciliar histórico antes de autorizar nova tentativa.
5. Executar só os IDs presentes no manifesto aprovado: primeiro as duas músicas,
   depois os pares de SFX. Registrar custos confirmados e saldo restante a cada
   pedido; interromper antes de faltar saldo. Fábrica, Turbosuco, Prefeito e vozes
   estão na direção/inventário, não no lote de geração aprovado.
6. Preservar os bytes retornados e hashes. Usar IDs de requisição/música e custo
   somente de uma allowlist de resposta; não persistir todos os headers. Tratar
   redirects como erro, pois o endpoint autorizado é fixo. Entregar amostras
   privadas para escolha, sem copiar para `public/`.

## Quantidade e estimativa a confirmar

| Trabalho | Pedidos | Duração solicitada |
| --- | ---: | ---: |
| Guaíra A/B | 2 | 80 s |
| Seis SFX A/B | 12 | 13,5 s |
| Vozes, stems, inpainting, regenerações | 0 | 0 |

A página pública de [preços da API](https://elevenlabs.io/pricing/api), consultada
em 02/10/2026, apresenta US$ 0,15/min para Music e US$ 0,12/min para SFX, mas a
FAQ também diz cobrança por geração. Ela distingue USD de créditos. Portanto:

- Proporção linear de segundos, **apenas ilustrativa**: `80/60 × 0,15 + 13,5/60
  × 0,12 = US$ 0,227`, antes de impostos.
- Hipótese de um minuto faturável por chamada, **não uma regra confirmada**:
  `2 × 0,15 + 12 × 0,12 = US$ 1,74`, antes de impostos.
- Não são cotação da conta, teto garantido, promessa de preço nem conversão de
  créditos. Não habilitam geração; entitlement e saldo ainda não foram lidos.
- Sem chamada nesta tarefa: gasto realizado **zero**. Uma nova tentativa é um
  novo consumo e deve caber no saldo existente e no lote revisado.

## Registro e passagem entre pacotes

Cada take usa `cue_id__variante__takeNN`; o manifesto registra SHA-256 do pedido
exato. Depois de gerar, preencher uma cópia do
[registro](../../tools/audio_offline/generation-record.example.json) por tentativa:
origem, modelo, formato, hora, IDs, custo, hash original, edição, audição, seleção
e evidência de direitos. Não marcar um arquivo como ouvido pelo simples fato de
ter metadados ou gráfico. O CSV gerado começa sem áudio e sem seleção.

Masters e revisões ficam fora de `public/`, `dist/`, `src/`, da árvore de outro
pacote e do controle de versões público. A pasta de trabalho ignorada não é backup:
arquivar os originais e registros em armazenamento privado aprovado pelo usuário
antes de descartar o ambiente. Não houve upload, push, merge, deploy ou acesso a
Oracle. A integração futura terá revisão própria após escolha e licença.
