# Revisão arcade r2 — geração exclusiva pelo root

**Nesta sessão: zero gerações e zero consumo.** O root informou 14 saídas já
geradas no [flow anterior](https://elevenlabs.io/app/flows/aoC2seBLqtH0qywcqdFt):
duas músicas e 12 SFX. As músicas estão rejeitadas pela direção, não por uma
audição feita aqui; preservar os originais. Os SFX ficam candidatos a reaproveitar.

## Gerar somente duas músicas substitutas

Fonte canônica: [pilot.json](../../tools/audio_offline/pilot.json), revisão
`sfg-arcade-r2`. `music[0].prompt` e `music[1].prompt` contêm os textos completos.
São **uma saída A e uma saída B**, ambas de 40 s, instrumentais, sem letra/fala.

| Saída | Direção | Modelo do plugin informado pelo root |
| --- | --- | --- |
| `mus_guaira_arcade__a__take01` — Salto de partida | Arcade de aventura, 120 BPM, synth dedilhado, bateria precisa, acentos pulse 8-bit | `eleven_music_v2_5` |
| `mus_guaira_arcade__b__take01` — Impulso pixel | Arcade mais cinético, 144 BPM, pulse/FM, baixo sincopado, bateria firme | `eleven_music_v2_5` |

Confirmar campos no schema atual do `creative-studio`. O modelo REST equivalente
é `music_v2_5`, com `music_length_ms:40000` e `force_instrumental:true`; não
presumir nomes iguais no nó do plugin. Sem seed, vozes, stems, inpainting ou
retry automático. Preferência MP3 48 kHz/192 kbps quando disponível; preservar
o formato realmente retornado. Não repetir geração somente por formato.

`prepare` agora exporta **apenas dois pedidos musicais**. Ele rejeita o schema
antigo e uma tentativa de reativar geração de SFX. Descrições de SFX no JSON são
um inventário de reaproveitamento, não novos pedidos. Exports antigos de 14
pedidos e o commit `7a714a5` são histórico, não instrução de execução atual.

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
