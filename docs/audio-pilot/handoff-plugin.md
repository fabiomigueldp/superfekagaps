# Handoff imediato ao root — execução única

**Zero áudios gerados, zero créditos gastos, zero IDs ou recibos de geração nesta
sessão.** Só existem pedidos locais. Uma tentativa REST de leitura de quota foi
bloqueada no túnel do proxy; não houve chamada de geração. A cópia local do anexo,
usada apenas após autorização posterior explícita do usuário, foi removida.

O root informou que seu plugin ElevenLabs está conectado e que a leitura
`creative_get_flow_node_types` sucedeu. Esta sessão pesquisou o catálogo atual e
não tem ferramentas ElevenLabs. A execução fica **exclusivamente no root**, via
plugin. Não retomar a rota REST nem copiar a credencial.

## Fonte exata de prompts

Arquivo canônico: [pilot.json](../../tools/audio_offline/pilot.json).

- `music[0].prompt`: Guaíra A — Caminho de casa, 40 s, instrumental.
- `music[1].prompt`: Guaíra B — Pátio em movimento, 40 s, instrumental.
- Para cada entrada de `sfx`, `a` e `b` são os dois prompts exatos; não são uma
  indicação para pedir duas saídas adicionais de cada prompt.

O export local reproduzível contém 14 descritores já expandidos em
`tools/audio_offline/work/sfg-guaira-pilot-final/requests/`, com manifest/hashes.
Execute `python tools/audio_offline/audio_offline.py prepare --output
tools/audio_offline/work/nova-revisao` apenas se precisar refazer o export.
Esse comando não usa a rede.

## Parâmetros semânticos para mapear ao schema real do plugin

| Família | Modelo REST documentado | Identificador informado pelo root para o nó | Quantidade |
| --- | --- | --- | --- |
| Music | `music_v2_5` | `eleven_music_v2_5` | 2 saídas totais, uma por proposta |
| SFX | `eleven_text_to_sound_v2` | `eleven_text_to_sound_v2` | 12 saídas totais, uma por prompt A/B |

Music: 40 segundos por proposta, instrumental sem letra/voz/coro. REST usa
`music_length_ms:40000` e `force_instrumental:true`; **não presumir que esses
nomes sejam campos do nó do plugin**. Ler `creative-studio` e tipos/configuração
atuais antes de montar o flow. Não usar o default Music antigo. Sem seed quando
o caminho REST usa prompt; o piloto não depende de seed.

| SFX (`cue_id`) | Duração de cada A/B | Loop |
| --- | ---: | --- |
| `sfx_feka_jump` | 0,5 s | false |
| `sfx_water_clean` | 1,5 s | true |
| `sfx_juice_viscous` | 1,5 s | true |
| `sfx_machine_warning` | 0,75 s | false |
| `sfx_machine_pressure` | 1,5 s | false |
| `sfx_machine_discharge` | 1 s | false |

Influência de prompt SFX sugerida: 0,35 **se o nó expuser esse controle**. Formato
de audição preparado no REST: Music MP3 48 kHz/192 kbps e SFX MP3 44,1 kHz/128
kbps. Confirmar no plugin o que é realmente suportado pelo nó/plano; preservar
resposta original no formato entregue e registrar qualquer diferença. Não
inventar campo do flow nem regenerar só por formato.

Não incluir Fábrica, Turbosuco, Prefeito, vozes, stems, inpainting ou repetições
extras neste lote. Esses itens estão apenas na direção futura. Máximo planejado:
14 saídas, 80 s de música e 13,5 s de SFX. Sem retry automático ou geração local
paralela. Confirmar saldo existente e ausência de cobrança adicional, conforme
o limite definido pelo root após a autorização do usuário.

Após gerar, devolver IDs/recibos, custo confirmado e arquivos originais privados
para audição/seleção. Preencher [registro por take](../../tools/audio_offline/generation-record.example.json)
e CSV de seleção. Não publicar no jogo: nenhuma licença comercial foi verificada
e nenhuma amostra foi ouvida nesta sessão.
