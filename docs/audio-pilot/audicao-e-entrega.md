# Masters, mixagem e critérios de aceitação

Esta é uma especificação de produção para depois da geração. Não há sample novo
para ouvir nesta entrega; todos os resultados auditivos e decisões estão pendentes.

## Originais e edição

Guardar cada resposta original byte a byte, com extensão real, hash e registro
de pedido. MP3 fornecido pela API é **original de geração com perdas**, não
master lossless. Um WAV decodificado desse MP3 serve à edição, mas não recupera
informação. Se o plano permitir PCM/WAV, confirmar antes o formato oficial e seu
custo; não provocar nova geração automaticamente para obter outro formato.

Estrutura privada sugerida, fora das pastas servidas:

```text
audio-production/sfg-guaira-pilot-01/
  requests/             # JSON e hashes; nenhum header com valor de credencial
  originals/            # respostas imutáveis por cue/variante/take
  working/              # WAV PCM para edição; nunca sobrescrever originals
  masters/              # edição aprovada, origem/limitações explicitadas
  review/               # A/B privados e cópias com volume comparável
  delivery-candidates/  # comprimidos, ainda sem autorização de publicação
  records/              # geração, custo, cortes, audição, seleção e direitos
```

Exportar master de edição WAV PCM 24-bit a 48 kHz se o fluxo de edição operar
nessa taxa; registrar a taxa original e qualquer reamostragem. Fazer todos os
cortes antes da codificação final. SFX pontuais podem ser mono após teste de
compatibilidade; música mantém estéreo controlado. Remover tags desnecessárias
somente dos derivados, preservando metadados/proveniência do original.

## Candidatos de compressão — só localmente

Comparar música Opus 96/128 kbps e Vorbis qualidade 4/5; SFX mono Opus 64/96 kbps
e Vorbis qualidade 3/4. Para alvos com suporte insuficiente, avaliar AAC/MP3 como
fallback, não adicioná-los todos ao pacote por padrão. Qualidade depende do
material, do codec de origem e dos navegadores. Evitar múltiplas recompressões.

Exemplos **não executados** para futuros masters aprovados, via FFmpeg local:

```sh
ffmpeg -nostdin -n -i masters/mus_guaira_a.wav -map_metadata -1 -c:a libopus -b:a 128k review/mus_guaira_a.webm
ffmpeg -nostdin -n -i masters/mus_guaira_a.wav -map_metadata -1 -c:a libvorbis -q:a 5 review/mus_guaira_a.ogg
```

`-n` impede sobrescrever. Uma música de 40 s a 128 kbps representa cerca de
640 kB de payload, antes de overhead; WAV s16 estéreo/48 kHz ocupa cerca de
7,68 MB. Esses são cálculos de formato, não uma promessa de qualidade ou tamanho
medido para o material ainda não gerado. Prever também memória decodificada:
40 s × 48.000 × 2 × 4 ≈ 15,36 MB por AudioBuffer estéreo float32.

## Loops e transições

- Música: marcar batida, compasso, ataque útil e fim em **amostras**, com taxa e
  limite final exclusivo. Cortar frases equivalentes; não recortar só pelo
  tamanho 40 s do pedido. Começar com fade de borda de 3–10 ms se necessário,
  ouvindo perda de transiente; crossfade maior de 20–80 ms só após conferir pulso.
- Textura água/suco: `loop:true` é pedido ao modelo, não certificação. Testar
  repetição por pelo menos 60 s e ausência de pulso periódico artificial.
- Ouvir pelo menos dez emendas em PCM e em cada formato decodificado. Comparar
  silêncio, click, flutuação de fase/baixo, cauda e deslocamento rítmico. Não
  confiar no padding informado pelo contêiner como marcador de loop.
- Preservar intro e tail separados se a melhor emenda exigir. Na futura engine,
  usar loopStart/loopEnd ou buffer já editado, com testes reais no navegador.
- Transições musicais: hipótese de crossfade 250–500 ms. Não crossfade de aviso
  crítico: ataque imediato no evento existente. Não usar timers do áudio para
  definir estado, dano ou progresso.

## Mixagem: ponto de partida, não regra certificada

| Material | Alvo inicial para derivados de revisão |
| --- | --- |
| Música | −20 a −18 LUFS integrados, true peak ≤ −1,5 dBTP |
| Ambientes água/suco | Discretos sob efeitos; regular por contexto, sem elevar ruído só para atingir LUFS |
| SFX comuns | Comparação perceptiva e pico, aproximadamente −9 a −6 dBFS de pico no asset |
| Aviso crítico | Ataque definido, próximo de −6 dBFS de pico; legível sem ser estridente |
| Voz futura | Hipótese −18 a −16 LUFS, true peak ≤ −2 dBTP; texto/alerta continuam prioritários |

Não normalizar SFX de 0,5 s para um LUFS de música. Medir pico/energia curta e
ouvir repetição. True peak deve ser medido de novo no derivado comprimido, pois
a codificação pode elevar picos. Não limitar agressivamente só para igualar A/B.

Na revisão A/B, primeiro igualar loudness sem esconder diferenças de dinâmica;
manter também os originais. Depois testar no mix: prioridade aviso de perigo →
ação do jogador/impacto → fala → música → ambiente. Hipótese de ducking: música
reduzida em 4–6 dB durante aviso/fala; ataque de 20–40 ms e retorno de 200–400 ms,
sem bombeamento. Não implementar essas curvas antes da revisão.

Os multiplicadores de WorldAudio foram criados para osciladores e não são uma
calibração automática para samples normalizados. Ajustar ganho por cue em uma
futura integração, com margem para simultaneidade. Começar com música baixa e
efeitos claros; confirmar que os três controles 0/25/50/75/100% e mute continuam
coerentes. A voz gravada atual tem rota diferente da voz procedural.

## Audição real e escolha

Registrar revisor, data, dispositivo, volume relativo, arquivo/hash e resultados
no CSV de seleção. Uma ferramenta que reproduz de fato pode fornecer evidência;
ffprobe, gráfico, teste de unidade e browser sem áudio capturado não equivalem
a audição. Até lá, `heard=false`.

1. Ouvir Guaíra A/B em fones e alto-falante pequeno, em estéreo e mono, com volume
   confortável e comparável. Fazer primeira escolha de identidade e uma sessão
   de repetição de 3 minutos para fadiga. Não selecionar apenas o mais alto.
2. Fazer identificação às cegas de água/suco e aviso/pressão/descarga. Meta inicial:
   pelo menos 8/10 identificações corretas por ouvinte e nenhum aviso confundido
   com descarga. Se houver um único revisor, registrar a limitação.
3. Testar cada SFX com a música baixa/média/alta, alternando variantes. O ataque
   deve ocorrer no começo útil do arquivo, sem pre-roll perceptível. Variantes
   preservam significado e volume próximo, sem alterar duração do gameplay.
4. Depois da seleção privada e autorização de integração, ouvir no jogo em
   desktop e dispositivo móvel, incluindo Safari/iOS se suportados: salto repetido,
   sentada, moeda, dano/capacete, aviso→pressão→descarga, água pública após vitória
   aceita, intro Turbosuco/pular/repetir, morrer/respawn, mapa e troca de faixa.
5. Conferir mute, sliders, pausa/foco, retorno, dispose, dez trocas rápidas e
   duas instâncias de cena: nenhuma fila antiga, loop preso ou áudio duplicado.
   Alertas visuais continuam funcionando com áudio desligado.

Uma proposta passa para **selecionada para edição** por identidade, clareza e
ausência de fadiga problemática, com notas ≥4/5 nesses três itens. Loop precisa
de aprovação separada; música pode ser escolhida e ainda exigir edição de loop.
“Pronta para publicar” exige além disso QA no runtime, compatibilidade dos
formatos e evidência de licença aplicável a cada plataforma/monetização.

## Licença e rastreabilidade

O registro separa `generated`, `heard`, `selected`, `rights_verified` e
`publish_allowed`. Não promover automaticamente uma etapa para a seguinte.
Anexar referência privada à evidência de licença, plano e data de geração,
termos aplicáveis, escopo de plataformas/monetização e responsável pela aprovação.
Não salvar segredo ou dados de pagamento no registro. O usuário tratará da
licença comercial; neste pacote todas as autorizações de publicação são falsas.
