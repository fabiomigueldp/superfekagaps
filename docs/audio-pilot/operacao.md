# Operação atual

Produção e integração foram autorizadas pelo usuário. O root gerou os arquivos
pelo plugin; esta sessão recebeu os 14 originais da branch de assets, conferiu
hashes, realizou edição local e integrou candidatos técnicos ao jogo. Não há
requisições de geração pendentes. A diferença entre a preferência Music v2.5 e
o modelo real `eleven_music_v2` está registrada, sem regeneração.

O trabalho está em `codex/audio-arcade-r2-integration`, baseado na integração
central `ab942feedde5edc0c735ed93b34647c1145c6a42`. O [README](README.md) apresenta
entregas, audição A/B e estado atual; o [runtime](runtime.md) descreve os pontos
de ligação e o [ledger](generation-ledger.json) preserva a proveniência.

Para reproduzir a edição, usar Python 3.10+ e FFmpeg/ffprobe:

```sh
python3 tools/audio_offline/finish_arcade.py /tmp/sfg-audio-new-edit
python3 -m unittest discover -s tools/audio_offline -p 'test_*.py'
npm run check
```

O destino deve ser novo e fica restrito a `/tmp` ou `tools/audio_offline/work`.
O script verifica os originais antes de editar e não escreve em `public`, não
usa rede, chave, instalação de credencial nem créditos. A cópia explícita dos
derivados para `public` faz parte da integração autorizada, depois das medições.

Os MP3 originais permanecem byte a byte. Os FLAC preservados são masters de
edição, sem recuperar perdas da geração. Não sobrescrever os originais nem
executar exports históricos de geração. A tentativa antiga de quota/403 consta
apenas no [histórico de acesso](access-status.json); não será repetida.

A licença comercial não foi verificada, conforme responsabilidade assumida
pelo usuário. Audição e seleção artística permanecem pendentes. Essas limitações
estão registradas; não se convertem em nova solicitação de autorização para a
branch já aprovada. Sem compras, recarga, mudança de plano, main ou deploy.
