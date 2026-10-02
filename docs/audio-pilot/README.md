# Super Feka Gaps — pacote sonoro piloto

Preparado em 2 de outubro de 2026 sobre `bc431d5`, na branch isolada
`codex/audio-offline-pilot`. Nenhum arquivo de gameplay, catálogo em uso, asset
existente, configuração de build ou dependência foi alterado.

O usuário aprovou a direção e o uso do saldo existente para o piloto. Não há
autorização para compra, recarga, mudança de plano ou cobrança adicional. Uma
autorização posterior no próprio fio permitiu usar o anexo para consultar saldo.
Um processo local leu a chave sem imprimi-la; o proxy bloqueou o túnel antes de
chegar à API e a cópia local foi removida. Nenhuma chave foi gravada neste repo
ou exposta à conversa. [Estado exato de acesso](access-status.json).

| Entrega | Arquivo |
| --- | --- |
| Direção, motivo Feka, propostas A/B, vozes futuras | [direcao.md](direcao.md) |
| Auditoria de código, arquivos e níveis medidos | [auditoria.md](auditoria.md) · [JSON de medições](audit-assets.json) |
| Inventário de cues e pontos de integração futuros | [cues.csv](cues.csv) |
| Dois prompts musicais e seis pares de SFX | [pilot.json](../../tools/audio_offline/pilot.json) |
| Preparação local e auditoria reproduzíveis | [audio_offline.py](../../tools/audio_offline/audio_offline.py) |
| Configuração segura, quota e execução futura | [operacao.md](operacao.md) |
| Masters, compressão, loops, mixagem e audição | [audicao-e-entrega.md](audicao-e-entrega.md) |
| Registro por geração, seleção e licença | [generation-record.example.json](../../tools/audio_offline/generation-record.example.json) |
| Escopo de autorização e bloqueios | [approval.example.json](../../tools/audio_offline/approval.example.json) |
| Documentação oficial consultada | [fontes.md](fontes.md) |
| Evidências de validação | [validacao.md](validacao.md) |
| Execução única via plugin no root | [handoff-plugin.md](handoff-plugin.md) |

## Estado real

- 14 pedidos preparados: 2 × 40 s de música + 12 variantes de SFX = 13,5 s de SFX.
- Uma tentativa de GET autenticado de quota bloqueada pelo proxy (403); nenhuma
  resposta da conta, zero gerações e zero gasto realizado nesta tarefa.
- Nenhuma nova amostra sonora existe ainda. Não houve audição humana ou no jogo.
- O utilitário só valida, calcula cenários, exporta JSON/CSV e mede arquivos locais.
  **Não tem executor HTTP, leitura de segredo, upload ou publicação.**
- Atualização final: o root informou conexão do plugin ElevenLabs e leitura
  bem-sucedida de seus tipos de nós. **Essa passa a ser a rota de execução única**;
  a sessão local não possui essas ferramentas e não fará gerações paralelas.
  O bloqueio do proxy afeta apenas a rota REST local abandonada. Não é necessário
  configurar outra credencial para o root usar o plugin já conectado.
- Root deve confirmar saldo/entitlement e ausência de cobrança adicional pelo
  plugin antes de gerar; a conta não foi verificada por esta sessão.
- Nenhuma licença foi verificada para publicação comercial. A futura seleção
  privada do piloto não libera incorporação ao jogo.

## Uso local, sem credencial

Na raiz deste worktree:

```sh
python tools/audio_offline/audio_offline.py validate
python tools/audio_offline/audio_offline.py estimate
python -m unittest discover -s tools/audio_offline -p 'test_*.py' -v
python tools/audio_offline/audio_offline.py prepare
python tools/audio_offline/audio_offline.py audit --output tools/audio_offline/work/audit-new.json
```

`prepare` cria `tools/audio_offline/work/sfg-guaira-pilot-01/` com 14 descritores
de pedidos, hashes, estimativa e `selection.csv` com estado `not_generated`.
Se a pasta já existir, o comando recusa sobrescrevê-la; use `--output` com outra
pasta dentro de `tools/audio_offline/work/` ou `/tmp/`. Outputs são ignorados pelo
Git. O arquivo `approval.example.json` é documentação de estado, não um interruptor
que habilita rede. Os JSONs exportados também não são executáveis.

Python 3.10+ basta para preparar; `ffmpeg` e `ffprobe` são necessários apenas para
auditoria. Nenhuma biblioteca Python, SDK da ElevenLabs ou pacote de runtime foi
adicionado. O diretório deste pacote não é uma entrada do Vite.
