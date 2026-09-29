# Placar global e hospedagem

O jogo público está em **https://superfekagaps.torbware.space/**. A Cloudflare mantém um registro A `superfekagaps` apontando para o Oracle (`163.176.73.223`), com proxy ativo e SSL/TLS Full (strict). O Caddy no Oracle termina HTTPS com certificado público e encaminha o tráfego para o serviço Node. O mesmo processo Node entrega o build de `dist/` e a API `/api/leaderboard`, mantendo tudo na mesma origem.

Na vitória, a tela mostra os dez maiores recordes. Somente quando a pontuação supera o recorde local aparece o formulário de publicação. O jogador escolhe um nome de 2 a 16 caracteres e clica **Publicar**. Não há envio automático. Um identificador aleatório persistido no navegador permite ao servidor manter apenas o melhor resultado daquele jogador; o servidor guarda somente o hash do identificador, nome, pontuação, tempo e data. O recorde local continua disponível se a rede falhar. O identificador não vincula contas nem permite recuperação em outro navegador.

A API usa Node 22 `node:sqlite` e SQLite em WAL, sem dependências npm. `GET /api/leaderboard` devolve até dez entradas. `POST /api/leaderboard` recebe JSON com `playerId` (UUID v4), `name`, `score` e `durationMs`; devolve `saved` e o ranking atualizado. `GET /healthz` serve para monitoramento. Nomes, tamanhos e origem são validados; há um limite básico de 20 envios por IP por hora. Os nomes são inseridos no DOM com `textContent`. Como a simulação ocorre no navegador, a API **não consegue provar que uma pontuação é legítima**: o placar é adequado para uma comunidade casual, mas não para premiações competitivas sem validação de partidas no servidor.

## Publicação no Oracle

Os arquivos versionados em `server/` documentam a configuração em produção. O serviço systemd `super-feka-gaps.service` usa `/home/ubuntu/super-feka-gaps-remaster`, com `server/leaderboard.mjs`, `dist/` e `data/scores.sqlite`. Apenas `data/` precisa ser gravável. O Node escuta no endereço interno `172.19.0.1:8787`; o Caddy alcança esse endereço pela rede Docker `adventurynetwork-app_edge`. A regra de firewall aceita a porta somente da interface e do IP internos do contêiner Caddy. Nenhuma porta do serviço Node está exposta à Internet.

Para publicar uma revisão:

```sh
npm run check
rsync -az --delete dist/ oracle:/home/ubuntu/super-feka-gaps-remaster/dist/
rsync -az server/leaderboard.mjs oracle:/home/ubuntu/super-feka-gaps-remaster/server/leaderboard.mjs
ssh oracle 'sudo systemctl restart super-feka-gaps.service'
curl -fsS https://superfekagaps.torbware.space/healthz
curl -fsS https://superfekagaps.torbware.space/api/leaderboard
```

Para manutenção, use `ssh oracle 'systemctl status super-feka-gaps.service'` e `ssh oracle 'journalctl -u super-feka-gaps.service -n 50 --no-pager'`. Faça backup consistente do SQLite com a API de backup do SQLite ou `VACUUM INTO`; não copie apenas `scores.sqlite` enquanto o WAL estiver ativo. O Caddyfile principal preserva os demais sites, e o bloco específico do jogo corresponde a `server/Caddyfile.snippet`.
