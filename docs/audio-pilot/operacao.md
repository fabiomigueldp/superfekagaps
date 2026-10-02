# Operação atual — revisão arcade r2

O usuário autorizou produção, integração ao jogo e publicação da branch no GitHub,
com identidade arcade original. O saldo existente pode ser usado; compra,
recarga, mudança de plano e cobrança adicional continuam fora do escopo.

## Uma única rota de geração

O root informou 14 arquivos do piloto anterior e a conclusão das **duas
músicas arcade substitutas** no flow `l5NIpun9E59Ud2olB4zR`, com modelo real
`eleven_music_v2`. A preferência v2.5 não foi atendida pelo enum do plugin.
**Não há pedidos novos pendentes.** Reaproveitar os 12 SFX como candidatos à
audição, sem gerar outro lote. Esta sessão não possui ferramentas ElevenLabs,
não retomará REST nem usará a chave anexada. Não contornar o 403 do proxy.

O [handoff](handoff-plugin.md) registra IDs reais informados, diferenças de
modelo, mapeamento e transferência por branch de assets. O
[ledger](generation-ledger.json) separa relatos do root das medições/recibos
ainda não recebidos. As músicas anteriores seguem rejeitadas pela direção;
preservar seus originais. Nenhuma audição foi realizada aqui.

## Consumo e estimativa histórica

A revisão pediu 2 × 40 s de música, zero SFX novos e zero vozes. A referência
pública usada antes da geração daria US$0,20 linear, ou US$0,30 sob a hipótese
não confirmada de minuto mínimo. São estimativas históricas, não recibo, cotação
do plugin/plano ou conversão de créditos. O custo efetivo não foi informado.
`estimate` agora informa zero requisições pendentes e `prepare` recusa um novo
export. Esta sessão mantém zero gerações e zero consumo pago.

## Integração e preservação

Receber os dois originais substitutos e 12 SFX numa branch de assets, com SHA
exato, hashes dos arquivos, IDs de provedor/flow e status de audição. Não incluir
credencial, URL assinada ou corpo completo de conta. Registrar qualquer modelo
ou formato efetivo diferente da preferência no pedido.

Fazer derivados editados/comprimidos; preservar originais e histórico de cortes,
loop, ganho e seleção. O pipeline de preparação atual não escreve em caminhos
servidos. O carregamento já foi implementado com catálogo vazio até o recebimento real,
com lifecycle, mute, pausa, fallback e cancelamento testados; ver [runtime](runtime.md).
A especificação de [audição e entrega](audicao-e-entrega.md) continua aplicável.

O integrador do root está em `ab942fee`, ainda não disponível neste ambiente.
Não alterar nem publicar main, não aplicar os nove pacotes paralelos pela branch
de áudio. A integração deve conferir os pontos tocados contra esse estado quando
recebido; manter diffs pequenos e restritos ao som. A licença comercial não foi
verificada por esta sessão e continua sob responsabilidade do usuário.
