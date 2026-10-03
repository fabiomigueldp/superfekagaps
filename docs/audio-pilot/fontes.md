# Fontes oficiais verificadas em 02/10/2026

Documentação consultada publicamente sem autenticação. Uma tentativa posterior
de leitura da conta foi bloqueada pelo proxy; não houve resposta da conta nem
verificação de licença. A documentação pode mudar antes da geração; reconferir
parâmetros, unidades de cobrança e permissões do plano na tarefa autorizada.

| Fonte | Aplicação neste pacote |
| --- | --- |
| [Compose Music](https://elevenlabs.io/docs/api-reference/music/compose) | POST `/v1/music`; fixar `music_v2_5`, pois default documentado ainda é `music_v1`. `prompt` e `composition_plan` são exclusivos; duração com prompt em ms; `force_instrumental:true`. Não enviar seed junto com prompt. O auto de modelos v2 aponta para MP3 48 kHz/192 kbps; o piloto fixa esse formato. A faixa de duração geral documentada é 3–600 s; o piloto restringe 30–45 s. |
| [Create sound effect](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert) | POST `/v1/sound-generation`; fixar `eleven_text_to_sound_v2`; `duration_seconds` 0,5–30; `loop` disponível nesse modelo; influência do prompt 0–1. MP3 192 kbps e PCM 44,1 kHz têm restrições de plano na página: não inferir entitlement. |
| [Models](https://elevenlabs.io/docs/overview/models) | Confirma `eleven_v4` para síntese de voz e `eleven_ttv_v3` para design. Vozes estão fora do piloto. |
| [Voice Design](https://elevenlabs.io/docs/eleven-creative/voices/voice-design) | Vozes desenhadas podem ser usadas com v4. A documentação chama a ferramenta de experimental; seleção depende de audição. |
| [Design a voice — API](https://elevenlabs.io/docs/api-reference/text-to-voice/design) | Modelos de design documentados: `eleven_multilingual_ttv_v2` e `eleven_ttv_v3`. Descrição 20–1000 caracteres, texto de preview 100–1000; resposta inclui previews e generated_voice_id. Não confundir preview com voz cadastrada nem usar referência de pessoa real neste projeto. |
| [ElevenAPI pricing](https://elevenlabs.io/pricing/api) | Referências públicas US$0,15/min Music e US$0,12/min SFX; FAQ fala em geração e USD. A estimativa tem hipóteses explícitas; saldo/entitlement da conta não verificados. Texto comercial genérico não libera o uso específico em jogos. |
| [Get user subscription](https://elevenlabs.io/docs/api-reference/user/subscription/get) | GET `/v1/user/subscription`; `max_credit_limit_extension=0` significa overage desativado. Tentativa de leitura autorizada posteriormente pelo usuário foi bloqueada no proxy, sem resposta da API. |
| [Cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environments) | Network secret substituído pelo proxy em HTTPS/443, com domínios permitidos; Personal vault e requisito no ambiente. Salvar/republicar configuração e iniciar nova tarefa para recebê-la. Não foi configurado segredo nesta tarefa. |

Os preços públicos podem divergir do plano da conta e a API pode expor cotas
diferentes por produto. Verificação da API e de setup não constitui parecer
jurídico nem confirmação de licença comercial. Não houve consulta ou alteração
de infraestrutura Oracle, deploy do jogo ou instalação persistente de chave.
