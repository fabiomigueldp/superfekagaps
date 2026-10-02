# Validação da entrega

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
