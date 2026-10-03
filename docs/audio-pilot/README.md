# Super Feka Gaps — áudio arcade integrado

Pacote técnico integrado em `codex/audio-arcade-r2-integration`, reconciliado
sobre `ab942feedde5edc0c735ed93b34647c1145c6a42` da integração central. Direção
arcade original, synth/FM/pulse e efeitos 8-bit pontuais; nenhuma identidade
regional intencional. As músicas anteriores rejeitadas não estão neste pacote.

Foram recebidos e conferidos os **14 originais** do commit
`5ad7ea10eee5b69f758c1728971fb1856346ee9a`: duas músicas arcade e seis pares de
SFX. O modelo musical efetivamente informado é `eleven_music_v2`; v2.5 era a
preferência do pedido, não o modelo executado pelo plugin.

Há 14 masters de edição FLAC preservados e **14 derivados de entrega, 2.105.748
bytes**. Os masters são edições de fontes MP3 com perdas. Somente os derivados
em `public/assets/audio/arcade-r2/` entram no build. Nenhuma nova geração,
credencial ou despesa foi necessária nesta integração.

| Entrega | Referência |
| --- | --- |
| Mapeamento, comportamento e reconciliação | [runtime.md](runtime.md) |
| Originais, masters e registros | [audio-pilots/arcade-r2](../../audio-pilots/arcade-r2/) |
| Cortes, ganhos, hashes e medições | [production-manifest.json](../../audio-pilots/arcade-r2/production-manifest.json) |
| Comparação A/B local | [review.html](../../audio-pilots/arcade-r2/review.html) |
| Registro de audição por arquivo | [selection.csv](../../audio-pilots/arcade-r2/selection.csv) |
| QA do navegador | [browser-qa.json](../../audio-pilots/arcade-r2/browser-qa.json) |
| Direção e inventário | [direcao.md](direcao.md) · [cues.csv](cues.csv) |
| Gerações e reconciliação de proveniência | [generation-ledger.json](generation-ledger.json) |
| Reprodução da edição offline | [finish_arcade.py](../../tools/audio_offline/finish_arcade.py) · [arcade-edits.json](../../tools/audio_offline/arcade-edits.json) |
| Validação | [validacao.md](validacao.md) |

Para ouvir os comparativos, executar `npm run dev` e abrir
`/audio-pilots/arcade-r2/review.html` no mesmo servidor. Essa página de revisão
não é publicada pelo build. Guaíra e Turbosuco podem ser abertos pelos experimentos.

A audição perceptual e a aprovação artística **não foram realizadas**. Os
arquivos estão integrados como candidatos técnicos: medição, decodificação e
testes de reprodução não certificam identidade, naturalidade da emenda ou
fadiga. A licença comercial permanece sob responsabilidade do usuário e não
foi verificada. Não houve merge em main ou deploy.

O piloto está marcado `generated_by_parent`; `prepare` recusa duplicação e
`estimate` indica zero pedidos pendentes. As instruções de geração anteriores
são histórico. Não usar novamente o anexo nem regenerar o lote.
