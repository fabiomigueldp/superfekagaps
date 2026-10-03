# Auditoria do áudio existente

> Auditoria histórica dos 33 arquivos sobre `bc431d5`. A entrega nova de 14
> arquivos e seus hashes/níveis estão no [manifesto de produção](../../audio-pilots/arcade-r2/production-manifest.json).

Base: `bc431d5`. Método: leitura de código e manifestos; `ffprobe` para metadados;
`ffmpeg loudnorm` para LUFS integrados/true peak de entrada, com saída descartada;
SHA-256 dos originais. [Dados de todos os arquivos](audit-assets.json).
Não houve reprodução para audição. Medição de clipping/nível não demonstra
qualidade percebida, ausência de artefatos ou emenda de loop.

Nenhum `AGENTS.md` foi encontrado na raiz, no workspace ou na árvore do repo.
O README pede testes e build antes da entrega. Alterações deste pacote ficam
somente em `docs/audio-pilot/` e `tools/audio_offline/`.

## Arquivos

| Grupo | Arquivos | Bytes | Formato observado | Uso |
| --- | ---: | ---: | --- | --- |
| Clássico | 5 | 28.800.220 | PCM s16, 48 kHz, estéreo, 30 s cada | `audioCatalog.ts`: theme/game/boss/powerup/ending |
| World | 10 | 10.556.216 | PCM s16, 22,05 kHz, mono | Prévias da galeria; não trilha carregada pelo World |
| João | 12 | 185.544 | 6 OGG/Vorbis + 6 WebM/Opus, 48 kHz, estéreo | Consumidores atuais usam os seis OGG |
| Delícia | 6 | 6.346.260 | WebM/Opus, 48 kHz, estéreo | Cinco faixas e um stinger no catálogo clássico |
| **Total** | **33** | **45.888.240** | | Tamanho em disco, não download inicial |

Os dez WAV World e os seis WebM alternativos do João são omitidos pelo build
atual, conforme [política existente](../build-output.md). Somente esses dois
grupos de exclusão somam 10.655.558 bytes. Não mover novo material para `public/`:
arquivos novos entram no build por padrão e o orçamento existente é 45.000.000
bytes para o pacote inteiro. O piloto desta entrega acrescenta zero bytes de
áudio ao runtime.

## Níveis medidos nos arquivos, antes dos ganhos do jogo

| Grupo | LUFS integrados | True peak (dBTP) | Implicação para a próxima etapa |
| --- | --- | --- | --- |
| Clássico | −13,64 a −12,37 | +0,01 a +0,04 | Pouca margem no arquivo; verificar picos após compressão |
| World/galeria | −35,42 a −33,56 | −16,47 a −15,45 | Não usar como referência direta de nível para áudio novo |
| Delícia | −27,10 a −9,02 | −15,50 a +0,91 | Amplitude grande entre stinger e músicas; ouvir e calibrar por função |
| João (ambos formatos) | −14,09 a −11,04 | −3,52 a +0,20 | Clipes menores que 3 s: LUFS não é alvo robusto isoladamente |

True peak positivo é uma estimativa de pico reconstruído do decodificador,
não prova de distorção audível. Os arquivos permanecem intactos. Em especial,
`delicia_ending` mede −9,02 LUFS/+0,91 dBTP e o stinger `ai_que_delicia` mede
−27,10 LUFS/−15,50 dBTP; normalizar ambos pelo mesmo número sem ouvir destruiria
o papel relativo que podem ter no jogo.

As durações dos nomes de voz não são exatamente as dos contêineres. Por exemplo,
`porra_nenhuma_0.36s.ogg` mede 0,4205 s; o WebM equivalente mede 0,360111 s.
Isso não autoriza corte automático: medir PCM decodificado, padding e silêncio
antes de definir início/fim. O manifesto tem tolerância de duração própria.

## Três caminhos de integração existentes

1. **Clássico:** [AudioEngine](../../src/engine/AudioEngine.ts) carrega/decodeia e
   mantém buffers; tem master, efeitos, música, ducking, crossfade e tokens para
   invalidar pedidos de música. [Catálogo](../../src/engine/audioCatalog.ts)
   declara volume e loop da faixa inteira; não declara limites de loop por amostra.
   [Audio](../../src/engine/Audio.ts) sintetiza os efeitos.
2. **World/Guaíra:** [WorldAudio](../../src/adventure/WorldAudio.ts) sintetiza
   notas e SFX, não busca os WAV da galeria. `select(world,boss)` usa melodias e
   tempos fixos; `tick` agenda osciladores. Ganhos: música = preferência × 0,14,
   efeitos × 0,30, voz procedural × 0,22; na morte a música recebe ainda × 0,15.
   Preferências iniciais em `progress.ts`: 0,55/0,70/0,80. Voz gravada usa
   `HTMLAudioElement.volume = preferência de voz`, fora desse bus procedural.
3. **Experimentos:** Guaíra herda WorldGame/WorldAudio e clona a fase base. O
   Prefeito adapta estados do modelo ao encontro nativo, que já emite `warning`.
   Turbosuco usa `select(3,true)`; `enrage` e `geyser-warning` hoje chamam ambos
   `pressure`, e `geyser` chama `jet`. Sua introdução tem
   [JuiceIntroAudio](../../src/adventure/experimental/JuiceIntroAudio.ts):
   cues procedurais canceláveis no bus de efeitos já desbloqueado.

Trocar um WAV não muda a trilha de Guaíra. Integrar música gravada ali exigirá um
adapter posterior com carregamento, lifecycle e loop explícitos. Este pacote
não adiciona esse adapter nem uma segunda trilha sobre o sequenciador.

## Vocabulário e lacunas relevantes

- `WorldAudio.sfx` conhece salto, pouso, moeda, selo, switch, dano, morte, queda,
  quebra, checkpoint, vitória, aviso, sentada, arremesso, pressão, jato/canhão e
  barril. `combatTones` distingue perda de capacete e pisão bloqueado.
- Pressão é ruído filtrado + tom; jato e canhão compartilham textura com durações
  diferentes. Não há identidade gravada própria de água limpa versus suco roxo.
- Água pública reaberta é estado de gameplay já implementado. Um som de água
  futuro deve observar o recibo de conclusão aceito do capítulo, sem inferir
  vitória por seleção/revisita ou conceder progresso a partir do áudio.
- O Prefeito ainda não tem marcha própria. Não mudar o contrato `select` global
  para atender só este experimento: mapear a cena explicitamente na etapa futura.
- Preservar `unlock` por gesto, mute, pausa, foco, dispose e cancelamento de fala
  na troca de cena. A introdução Turbosuco descarta cues interrompidos, inclusive
  ao pular/repetir; uma versão com samples precisa manter essa semântica.
- Não há licença comercial comprovada por esta auditoria para os assets atuais
  ou futuros. O `MIT` do código não verifica a procedência de gravações.

O [inventário](cues.csv) separa pontos já existentes de propostas. Hooks citados
são referências de leitura para o trabalho futuro, não alterações feitas.
