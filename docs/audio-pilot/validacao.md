# Validação da revisão arcade r2

## Entrega reconciliada com a integração central

Base: `ab942feedde5edc0c735ed93b34647c1145c6a42`. Assets recebidos do commit
`5ad7ea10eee5b69f758c1728971fb1856346ee9a`. Nenhum pacote das nove frentes foi
sobrescrito; 36 arquivos da integração foram conferidos byte a byte e os dois
pontos compartilhados ficaram restritos às ligações de áudio. O conflito de texto ao lado do botão de som foi resolvido mantendo
a saída para experimentos e os guards de navegação da integração central.

| Verificação | Resultado |
| --- | --- |
| `npm run check` sobre a base conjunta | **1.300 testes TypeScript + 3 testes de servidor**, zero falhas; validadores, dois typechecks e Vite build |
| Python/FFmpeg | **7 testes passaram**, incluindo duração exata do loop após crossfade e recusa de nova geração do piloto concluído |
| Proveniência | 14 originais, 14 masters e 14 derivados conferidos por SHA-256 |
| Entrega de áudio | 2.105.748 bytes; masters de edição 10.022.420 bytes fora do build |
| Build final | **155 arquivos / 42.695.227 bytes**, limite 45.000.000; margem 2.304.773 bytes; 21 arquivos de revisão omitidos |
| Navegador | Chromium 151 headless; 14 derivados decodificados a 48 kHz; música real da Travessia e ambiente de água também verificados a 44,1 kHz |
| Loops | Dez emendas de cada uma das seis faixas em OfflineAudioContext; sem clipping e sem intervalo agendado entre ciclos; não equivale a aprovação perceptual |
| Lifecycle | Música substituiu o sintetizador (zero fontes procedurais musicais restantes); mute e pausa testados; descarte de eventos/fetches atrasados e de fallback coberto nos testes |
| UI | Home, Travessia, mapa do capítulo e controle SOM/MUDO renderizados; mapa em viewport 390 px sem overflow horizontal |
| Geração/segredo | Zero novas gerações, chamadas autenticadas, instalação de credencial ou consumo nesta integração |

Evidência reproduzível: [manifesto de produção](../../audio-pilots/arcade-r2/production-manifest.json),
[QA do navegador](../../audio-pilots/arcade-r2/browser-qa.json) e testes versionados.
O script de edição usa somente Python stdlib + FFmpeg/ffprobe; nenhuma dependência
ou lockfile do jogo mudou. Agent-browser foi instalado em cache temporário para
QA, com Chromium já disponível, sem alterar o projeto.

A primeira edição experimental local revelou que um uso de `acrossfade` com
dois blocos do tamanho exato da sobreposição encurtava o período. A versão
entregue usa fades complementares e mistura, preserva o número exato de samples
e possui teste de regressão que verifica esse resultado. O arredondamento de
resample do navegador também recebeu um teste específico.

Não houve audição perceptual, aprovação artística, teste em dispositivo móvel
real ou Safari/iOS, verificação de licença comercial, main/deploy ou Oracle.
O render offline não certifica emenda musical natural nem ausência de fadiga.
A página A/B e o CSV de seleção permitem concluir essa revisão sobre hashes
estáveis, sem gerar novamente.

## Histórico: preparação anterior ao recebimento dos assets

- `npm run check` passou: **1.254 testes TypeScript + 3 de servidor**, validadores,
  dois typechecks e Vite build. Oito testes novos cobrem o carregador/fallback e
  lifecycle, inclusive a ligação com `WorldAudio`.
- Cinco testes Python passaram; o novo teste impede exportar novamente o piloto
  marcado `generated_by_parent`. `estimate` informa zero pedidos pendentes.
- Build: 141 arquivos, **40.579.558 bytes**, abaixo de 45.000.000 bytes. Nenhum
  novo arquivo de áudio foi incluído. Os 21 arquivos de revisão continuam omitidos.
- JSON, links locais da documentação e `git diff --check` passaram. Dependências
  e lockfile não mudaram.
- O root informou dois nós de música arcade concluídos, modelo real
  `eleven_music_v2`, registrados no ledger. Nenhuma geração local, novo uso do
  anexo ou consumo pago nesta rodada.
- Runtime preparado com catálogo vazio: nenhum asset fictício ou novo som ativo.
  Os 14 arquivos gerados ainda não chegaram. Não foram medidos nem ouvidos aqui.
- Alteração fora de áudio: uma linha em `WorldGame.load`, que passa o ID da cena
  à seleção sonora. Físicas, fases, progresso, chefes e intro Turbosuco não mudaram.
- Base validada `bc431d5`; o integrador `ab942fee` ainda não está disponível aqui.
  Conferência com esse trabalho paralelo permanece pendente.

## Evidência da preparação anterior à geração arcade

- Quatro testes Python passaram: export exclusivamente musical (duas saídas),
  rejeição do schema antigo/lote integral, direção arcade, IDs/durações/modelos,
  operação com sockets bloqueados e isolamento/não sobrescrita de saídas.
- Os 12 prompts SFX permanecem iguais aos do lote anterior e não são exportados
  como novas requisições. As duas músicas foram reescritas; IDs têm sufixo arcade.
- Export r2: 80 s de música e zero SFX novos. Manifesto SHA-256:
  `e56cb980785f660fa4255ea33656f131be22331252bef03fd579343e4350b961`.
- Nenhuma geração, chamada com anexo ou consumo nesta rodada. Plugin ausente aqui.
- Nenhuma alteração de gameplay nesta revisão; integração depende dos arquivos
  do root e conferência contra o integrador `ab942fee`, ainda não recebido.

## Evidência anterior, preservada como histórico


Executada em 02/10/2026, sobre `bc431d5`, no worktree
`/workspace/superfekagaps-audio`, branch `codex/audio-offline-pilot`.

| Verificação | Resultado |
| --- | --- |
| `npm run check` | Passou: 1.246 testes TypeScript + 3 testes de servidor; validadores, dois typechecks e Vite build |
| Testes Python do pipeline | 4 passaram; schema, modelos/durações, orçamento de todas as variantes, export sem rede, hashes, não sobrescrita e isolamento de saída |
| Preparação de pedidos | 14 arquivos JSON; 80 s de música + 13,5 s de SFX; zero executor HTTP |
| Inventário | 32 cues; 7 linhas de piloto (1 cue musical com propostas A/B e 6 cues SFX com A/B) |
| Auditoria de originais | 33 arquivos; hashes SHA-256 reconferidos e intactos após os checks |
| JSON e links locais da documentação | Válidos |
| Build local | 141 arquivos / 40.574.974 bytes; pacote sonoro ausente do output; 21 arquivos de revisão omitidos pela política existente |
| Escopo do diff | Apenas `docs/audio-pilot/` e `tools/audio_offline/` |
| Credencial após autorização posterior | Valor não impresso; cópia temporária removida; consulta de quota bloqueada antes da API por proxy 403 |

SHA-256 do manifesto de pedidos exportado:
`c8c53c0b0b65a7bfad7e24277d2bb6035e1bdf990691e3bbae9d3df7335885ae`.
O export final local está em `tools/audio_offline/work/sfg-guaira-pilot-final/`;
é ignorado pelo Git e reproduzível com `prepare --output` usando pasta nova.

As dependências de desenvolvimento existentes foram instaladas pelo lockfile,
com scripts de instalação desativados. Nenhuma dependência ou lockfile mudou.
A tentativa inicial de usar apenas cache npm falhou por pacote ausente; a
instalação normal no registry permitido funcionou. Os testes completos passaram
na primeira execução nesta tarefa, sem necessidade de alterar gameplay.

Não houve teste auditivo, nova amostra, geração paga, push, merge, deploy ou
acesso a Oracle. A permissão adicional de rede também não liberou o domínio
ElevenLabs. Isso é bloqueio do proxy, **não** rejeição de aprovação automática e
**não** erro 403 de autenticação da ElevenLabs. A validade da chave não foi testada.

Atualização final do root: plugin ElevenLabs conectado, leitura de tipos de nós
confirmada por ele. O catálogo desta sessão não contém ferramentas ElevenLabs.
Entrega transferida ao root para geração única pelo plugin; nenhum recibo local
de geração a reconciliar e nenhuma geração REST local em andamento.
