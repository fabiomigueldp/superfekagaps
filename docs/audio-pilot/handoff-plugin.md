# Revisão arcade r2 — geração exclusiva pelo root

**Nesta sessão: zero gerações e zero consumo.** O root informou 14 saídas já
geradas no [flow anterior](https://elevenlabs.io/app/flows/aoC2seBLqtH0qywcqdFt):
duas músicas e 12 SFX. As músicas estão rejeitadas pela direção, não por uma
audição feita aqui; preservar os originais. Os SFX ficam candidatos a reaproveitar.

## Duas músicas substitutas concluídas — não gerar novamente

O root informou a conclusão de A e B no
[flow arcade r2](https://elevenlabs.io/app/flows/l5NIpun9E59Ud2olB4zR).
Os prompts pedidos ficam preservados em
[pilot.json](../../tools/audio_offline/pilot.json), mas o status agora é
`generated_by_parent` e `prepare` bloqueia outro export.

| Saída | Nó informado pelo root | Modelo real informado |
| --- | --- | --- |
| `mus_guaira_arcade__a__take01` — Salto de partida | `hm9vDDKaLjGeDoFhGAUP` | `eleven_music_v2` |
| `mus_guaira_arcade__b__take01` — Impulso pixel | `eFFpzG5UMvU8XTgxZMbSx` | `eleven_music_v2` |

A intenção no pedido era Music v2.5, mas o enum do plugin não aceitou
`eleven_music_v2_5`, segundo o root. Não declarar que o modelo v2.5 foi usado.
Não repetir geração por modelo/formato. Formato e duração finais aguardam os
arquivos; custos reais aguardam recibos. Nenhum novo SFX foi pedido na revisão.

## Reaproveitar os 12 SFX existentes, após audição

| IDs A/B do lote anterior | Referência atual | Aplicação futura |
| --- | --- | --- |
| `sfx_feka_jump` | `WorldAudio.sfx('jump')` | Editar ataque/cauda; alternância A/B controlada |
| `sfx_machine_warning` | `warning`; Turbosuco hoje usa `pressure` no geyser-warning | Cue legível sem mudar janela visual/física |
| `sfx_machine_pressure` | `pressure` | Seguir/cancelar estado existente; não encadear descarga por timer do áudio |
| `sfx_machine_discharge` | `jet` / `cannon` | Descarga imediata, distinta do aviso e da pressão |
| `sfx_water_clean` | Ainda não há bus de ambiente por estado aceito | Só quando água pública estiver realmente aberta; não ligar por revisita |
| `sfx_juice_viscous` | Ainda não há loop de ambiente dedicado | Somente com fonte de suco existente, limitado por cena/distância |

Cada cue tem variantes `a` e `b`. Não foram ouvidas aqui e não se declara que
combinam com a música nova antes da comparação. Se faltar qualidade, comunicar
o cue específico ao root; não regenerar os 12 em bloco. Os alertas visuais e
toda a lógica do jogo permanecem autoridades de timing.

## Transferência recebida — contrato histórico

Recebido de `origin/codex/audio-arcade-r2-assets`, SHA
`5ad7ea10eee5b69f758c1728971fb1856346ee9a`, somente
`audio-pilots/arcade-r2/`. Os 14 MP3 conferiram com o manifesto: 2.408.946 bytes.
O README e manifesto recebidos foram preservados junto dos originais.

A entrega e a integração estão descritas no [README](README.md). Não há bloqueio
de transferência ou credencial. A Library não foi necessária; o transporte por
GitHub funcionou. Não houve geração adicional, instalação de segredo ou gasto.

**Divergência de metadado:** a mensagem inicial informou o nó B como
`eFFpzG5UMvU8XTgxZMbSx`; o manifesto recebido informa `FFpzG5UMvU8XTgxZMbSx`.
Ambos foram preservados no ledger para o root reconciliar. O arquivo B foi
identificado pelo SHA-256 verificado, sem depender dessa grafia nem chamar a API.

## Trabalho paralelo

A integração central `ab942feedde5edc0c735ed93b34647c1145c6a42` foi recebida e
incorporada como base da branch de áudio. O conflito no cabeçalho do mapa foi
resolvido preservando o texto de saída e os guards novos. O restante dos nove
pacotes foi mantido intacto; ver [runtime.md](runtime.md) e [validação](validacao.md).
