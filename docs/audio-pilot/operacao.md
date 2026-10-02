# Operação atual — revisão arcade r2

O usuário autorizou produção, integração ao jogo e publicação da branch no GitHub,
com identidade arcade original. O saldo existente pode ser usado; compra,
recarga, mudança de plano e cobrança adicional continuam fora do escopo.

## Uma única rota de geração

O root informou plugin ElevenLabs conectado e 14 arquivos do piloto anterior já
gerados. **Gerar somente as duas músicas substitutas** de `sfg-arcade-r2`.
Reaproveitar os 12 SFX como candidatos à audição, sem gerar outro lote. Esta sessão
não possui ferramentas ElevenLabs; não retomará REST nem usará a chave anexada.
O bloqueio 403 do proxy não deve ser contornado.

O [handoff](handoff-plugin.md) define IDs, parâmetros, mapeamento de efeitos e
transferência por branch exclusiva de assets. O [ledger](generation-ledger.json)
separa o relato de geração do root das medições/recibos ainda não recebidos.
As duas músicas anteriores estão rejeitadas pela direção; preservar os originais.

Antes das duas chamadas, o root confere no plugin o modelo efetivo e os limites
da conta. Sem retry automático. Timeout ou resposta perdida pode já ter sido
cobrado; reconciliar IDs/histórico antes de qualquer nova tentativa. Não supor
que créditos Creative e USD API sejam equivalentes.

## Quantidade nova e estimativa indicativa

A revisão nova solicita 2 × 40 s de música, **zero SFX novos** e zero vozes.
A referência pública anterior de US$0,15/min de Music daria US$0,20 em proporção
linear; uma hipótese não confirmada de minuto mínimo por chamada daria US$0,30.
Esses cálculos não são cotação do plugin/plano, teto garantido ou conversão de
créditos. O custo do lote anterior só pode ser preenchido pelos recibos do root.
A geração feita por esta sessão continua zero.

## Integração e preservação

Receber os dois originais substitutos e 12 SFX numa branch de assets, com SHA
exato, hashes dos arquivos, IDs de provedor/flow e status de audição. Não incluir
credencial, URL assinada ou corpo completo de conta. Registrar qualquer modelo
ou formato efetivo diferente da preferência no pedido.

Fazer derivados editados/comprimidos; preservar originais e histórico de cortes,
loop, ganho e seleção. O pipeline de preparação atual não escreve em caminhos
servidos. A futura etapa de integração autorizada será uma alteração explícita
no pacote de áudio, com lifecycle, mute, pausa, fallback e cancelamento testados.
A especificação de [audição e entrega](audicao-e-entrega.md) continua aplicável.

O integrador do root está em `ab942fee`, ainda não disponível neste ambiente.
Não alterar nem publicar main, não aplicar os nove pacotes paralelos pela branch
de áudio. A integração deve conferir os pontos tocados contra esse estado quando
recebido; manter diffs pequenos e restritos ao som. A licença comercial não foi
verificada por esta sessão e continua sob responsabilidade do usuário.
