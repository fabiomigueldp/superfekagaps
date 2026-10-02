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

## Transferência dos assets entre ambientes

O root deve disponibilizar somente arquivos e registros de áudio numa branch
dedicada, por exemplo `codex/audio-generated-arcade-r2`, sem merge em `main`.
Enviar o SHA exato para que esta sessão possa buscar esse commit e importar
somente a pasta `audio-deliveries/sfg-arcade-r2/`. Não incluir os nove pacotes de
gameplay ainda locais ao integrador. Não depender de disco compartilhado.

A Library deste ambiente expõe apenas envio (`create_library_file`,
`prepare_uploads`, `finalize_uploads`, `replace_library_file`). Não há
`prepare_materialize`/leitura de arquivos neste catálogo. Um Library ID isolado
não basta para baixar aqui; preferir a branch de assets. Um objeto completo de
transferência preparado pela Library no root poderá ser tentado com o helper
oficial, se disponibilizado, sem copiar links assinados para o Git.

Estrutura esperada:

```text
audio-deliveries/sfg-arcade-r2/
  manifest.json
  originals/mus_guaira_arcade__a__take01.mp3
  originals/mus_guaira_arcade__b__take01.mp3
  originals/sfx_feka_jump__a__take01.mp3
  ... restantes SFX A/B com os IDs anteriores ...
```

Usar a extensão realmente recebida. Cada registro do manifesto precisa de `id`,
`relative_path`, `sha256`, `source_pilot_id`, `flow_id`, `provider_node_id`,
`provider_model_id` real, duração/formato medidos se disponíveis e estado da
audição. Custos e IDs ausentes devem ser `null`, sem inventar recibos. Não
versionar links assinados, credenciais ou respostas completas de conta. Originais
das duas músicas rejeitadas continuam preservados no armazenamento do root/flow.

Depois do recebimento: medir e ouvir, selecionar/cortar/ajustar loops, derivar
arquivos de entrega, integrar carregamento/lifecycle/ganhos e testar no jogo.
O usuário autorizou integração e publicação no GitHub. Isso não implica deploy
ou merge automático; a licença comercial segue sob responsabilidade do usuário
e não foi verificada por esta sessão.

## Trabalho paralelo

O root informou o integrador em `ab942fee`, com nove pacotes ainda não publicados.
Esse commit não está disponível neste ambiente; `origin/main` ainda é `bc431d5`.
Não afirmar compatibilidade com arquivos que não foram recebidos. Esta revisão
de prompts/pipeline não toca gameplay. A futura integração sonora terá diff
concentrado no áudio e deverá ser reaplicada/conferida contra o SHA do integrador.
