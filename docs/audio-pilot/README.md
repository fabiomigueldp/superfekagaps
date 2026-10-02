# Super Feka Gaps — áudio arcade r2

Direção corrigida conforme pedido do usuário: aventura arcade original, alto
acabamento, motivos memoráveis, synth/FM/pulse e efeitos 8-bit quando úteis.
A identidade musical não é geográfica. Não copiar melodias ou identidade de
franquias. [Direção completa](direcao.md).

O root já gerou o piloto anterior: duas músicas e 12 SFX. As **duas músicas estão
rejeitadas como candidatas**; seus originais e histórico devem ser preservados.
Os 12 SFX ficam candidatos a reaproveitamento depois da audição. A revisão ativa
é `sfg-arcade-r2` e solicita **somente duas novas músicas de 40 segundos**.

| Entrega | Arquivo |
| --- | --- |
| Dois prompts musicais arcade exatos | [pilot.json](../../tools/audio_offline/pilot.json) |
| Modelo, parâmetros, reaproveitamento e transferência ao integrador | [handoff-plugin.md](handoff-plugin.md) |
| Estado das gerações, sem inventar recibos | [generation-ledger.json](generation-ledger.json) |
| Direção e inventário | [direcao.md](direcao.md) · [cues.csv](cues.csv) |
| Auditoria dos 33 arquivos existentes | [auditoria.md](auditoria.md) · [medições](audit-assets.json) |
| Preparação local sem rede | [audio_offline.py](../../tools/audio_offline/audio_offline.py) |
| Operação atual | [operacao.md](operacao.md) |
| Masters, loops, mixagem e audição | [audicao-e-entrega.md](audicao-e-entrega.md) |
| Registro por take | [generation-record.example.json](../../tools/audio_offline/generation-record.example.json) |
| Autorizações e limites | [approval.example.json](../../tools/audio_offline/approval.example.json) |
| Fontes e validação | [fontes.md](fontes.md) · [validacao.md](validacao.md) |

## Coordenação e escopo

- Geração exclusivamente pelo plugin conectado do root. Nenhum áudio ou consumo
  foi produzido nesta sessão; as ferramentas ElevenLabs não estão disponíveis aqui.
- Os arquivos gerados no root ainda não estão neste ambiente. Transferir por
  branch dedicada de assets e SHA exato; ver o contrato no handoff.
- O usuário autorizou produção, integração ao jogo e envio ao GitHub. Não é
  autorização de merge em main, deploy ou gasto adicional fora do saldo existente.
- Branch isolada `codex/audio-offline-pilot`. O integrador informou HEAD `ab942fee`,
  ainda indisponível aqui; base local/runtime auditado é `bc431d5`. Nenhum pacote
  paralelo de gameplay foi alterado por esta revisão.
- O anexo não será usado novamente. A tentativa anterior de leitura de quota,
  feita após autorização específica, foi bloqueada pelo proxy e a cópia removida;
  [registro histórico de acesso](access-status.json). Não contornar o 403.
- Audição e licença comercial não foram verificadas por esta sessão. A licença
  continua sob responsabilidade do usuário; arquivos rejeitados não entram no jogo.

## Comandos locais sem credencial

```sh
python tools/audio_offline/audio_offline.py validate
python tools/audio_offline/audio_offline.py estimate
python -m unittest discover -s tools/audio_offline -p 'test_*.py' -v
python tools/audio_offline/audio_offline.py prepare
```

O export ativo é `tools/audio_offline/work/sfg-arcade-r2/`, com **dois** pedidos
musicais, manifesto/hash e CSV de seleção. Use uma pasta nova com `--output` se
já existir. Outputs são ignorados pelo Git. O pipeline não contém executor HTTP,
leitura de segredo, upload ou publicação. Ele valida as descrições dos SFX para
rastreabilidade mas não as exporta para geração de novo. O schema anterior foi
invalidado para evitar uso acidental do lote antigo.

Python 3.10+ basta para preparar; FFmpeg/ffprobe são opcionais para auditoria.
Nenhuma dependência nova foi adicionada. Os prompts rejeitados ficam preservados
no histórico do commit `7a714a5`, não na configuração ativa.
