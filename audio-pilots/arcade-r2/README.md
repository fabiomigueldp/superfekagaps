# Entrega arcade R2

Os 14 MP3 em `originais/`, o manifesto técnico e `README.txt` são a entrega
preservada da branch de assets, commit `5ad7ea10eee5b69f758c1728971fb1856346ee9a`.
As instruções pré-integração do `.txt` descrevem aquele momento; o usuário
posteriormente confirmou a integração, entregue aqui como candidato técnico.

- `masters/`: 14 FLAC de edição, derivados dos MP3 com perdas.
- `production-manifest.json`: cortes, filtros, ganho linear, formatos, hashes,
  medições antes da mixagem e estado de revisão.
- `original-metrics.json`: análise dos originais sem audição; candidatos de
  andamento são hipóteses de autocorrelação, não transcrição musical aprovada.
- `browser-qa.json`: decodificação e render de loops, sem audição perceptual.
- `review.html`: comparação A/B disponível pelo servidor Vite local.
- `selection.csv`: registro de audição ainda não preenchido.

Somente `public/assets/audio/arcade-r2/` é servido no build. Detalhes e limites
em [docs/audio-pilot](../../docs/audio-pilot/README.md).

Não houve nova geração. O modelo musical efetivo informado é `eleven_music_v2`.
O ID de B diverge entre a mensagem do root e o manifesto recebido; ambos foram
preservados no ledger. O hash do arquivo confere. A licença comercial não foi
verificada; sua gestão segue com o usuário. Não houve deploy ou merge em main.
