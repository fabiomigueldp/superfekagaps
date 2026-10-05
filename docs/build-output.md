# Pacote de publicação

## Atualização — segunda produção da Delícia, 5 de outubro de 2026

A expansão agora publica 13 WebP e 20 áudios Opus. Seis novos assets imagegen e o diorama são empacotados em formatos de runtime; os mestres ficam em `docs/world/delicia/`. O [modelo reconstruído, revisão 3](world/delicia/modelo-v3.md), usa um WebP de 3.200 × 2.000. O build atualizado tem **51.429.046 bytes**, abaixo do limite de **53.000.000 bytes**; [medição](world/delicia/build-size-v3.json). As 21 exclusões anteriores permanecem iguais. [Conteúdo e validação da campanha](world/delicia/entrega-v2.md).

As medições abaixo são históricas; a medição atual é produzida por `npm run size:build`.

## Atualização — Império da Delícia, 4 de outubro de 2026

A nova entrada `delicia.html` publica a expansão com sete WebP, vinte áudios Opus
e metadados do mapa. Os mestres PNG, MP3, Blender e GLB ficam em
`docs/world/delicia/`, fora de `public/`. O orçamento foi atualizado para
50.000.000 bytes para comportar esse conteúdo solicitado. A lista anterior de
21 exclusões permanece inalterada, e nenhuma fonte anterior foi recomprimida.

A medição consolidada é 201 arquivos e 48.835.589 bytes; a margem é 1.164.411 bytes.
Veja o [relatório da expansão](world/delicia/entrega.md) e a
[medição detalhada](world/delicia/build-size.json). Os valores abaixo documentam
as auditorias históricas anteriores à expansão.

O build copia os assets de `public/` por meio de `scripts/build_output_policy.ts`.
A lista de exclusão contém **21 caminhos exatos** revisados; novos arquivos são
incluídos por padrão. O filtro só roda no build. Nenhum original é removido ou
recomprimido, e o servidor `npm run dev` continua servindo todas as referências.

## Auditoria de 2 de outubro de 2026

Base `48e0cb6`, incluindo o pacote local de vitalidade da travessia de Guaíra.
Foram conferidas referências estáticas e construídas em runtime, os 13 HTML do
repositório, manifestos e scripts. Os sete HTML da raiz são entradas de produção;
as seis páginas de documentação não fazem parte de `dist/`. A configuração da
Vercel publica somente esse diretório.

| Arquivos omitidos do build | Quantidade | Bytes | Motivo |
| --- | ---: | ---: | --- |
| Capas PNG de `assets/branding/` | 4 | 9.908.344 | README, estudos e galeria gráfica de desenvolvimento |
| `assets/sprites/yasmin.png` | 1 | 2.527.709 | Sprite antigo; o renderer usa os quadros nativos do atlas |
| Demos WAV de `assets/world/audio/` | 10 | 10.556.216 | Prévias da galeria; o World sintetiza a trilha em tempo real |
| Alternativas WebM de `assets/audio/vo/joaozao/` | 6 | 99.342 | Os dois consumidores de voz requisitam os seis OGG |
| **Total** | **21** | **23.091.611** | |

A galeria `docs/graphics-v2/index.html` exibe a capa abismo. A galeria
`docs/world/capturas/index.html` monta dinamicamente os dez players WAV. Ambas
continuam com seus originais disponíveis no desenvolvimento. Publicar essas
galerias futuramente exige rever a exclusão junto com suas dependências.
O build falha caso encontre documentação no output ou referência literal a um
asset omitido em HTML, JS, CSS ou JSON. Essa proteção não substitui a auditoria
de novas URLs construídas dinamicamente.

## Medição e proteção contra regressão

- Antes: **135 arquivos, 63.457.318 bytes**
- Depois: **114 arquivos, 40.365.707 bytes**
- Redução: **23.091.611 bytes, 36,39%**
- Os 114 arquivos restantes, inclusive bundles e HTML, são byte a byte idênticos
  ao build anterior; apenas os 21 caminhos revisados deixam de ser copiados

O próprio build imprime quantidade e tamanho do output e aplica um orçamento de
**45.000.000 bytes**, com cerca de 4,6 MB de margem sobre esta medição. É uma
proteção do repositório contra crescimento acidental, não uma cota da hospedagem.
`npm run size:build` verifica o `dist/` existente sem reconstruí-lo e lista os dez
maiores arquivos. Em ambientes onde o IPC da CLI `tsx` é bloqueado, o equivalente
é `node --import tsx scripts/check_build_size.ts`.

A redução mede arquivos do pacote de deploy, não o download inicial, a memória
do navegador ou FPS. Ela reduz o tamanho das próximas publicações e não recupera
o espaço das publicações antigas. A medição foi local; nenhuma publicação ou
remoção de deployment fez parte desta etapa.

Validação da árvore consolidada: quatro testes da política, 790 testes TypeScript,
três testes de servidor, os três validadores, ambos os typechecks e build passaram.
A primeira rodada completa teve duas falhas no arquivo existente
`guaira-map-ui.test.ts` (seleção contextual e quantidade de callbacks de água).
O arquivo passou isoladamente e uma segunda rodada completa passou sem alteração
de código. A intermitência foi registrada; sua causa não foi corrigida nem
atribuída a uma regressão resolvida neste pacote.

## Próxima avaliação de música, sem conversão nesta etapa

O lote seguinte de Guaíra acrescenta o Pátio das Comportas e controles locais de
toque, além de polimento nativo de cenários e chefe. O output consolidado mede
**120 arquivos, 40.403.971 bytes**, sem texturas, música ou dependências novas.
O filtro dos21 originais continua aplicado e o orçamento segue45.000.000 bytes.
Essa é uma medição de arquivos de deploy, não de carregamento inicial ou memória.

As cinco músicas clássicas usadas por `src/engine/audioCatalog.ts` permanecem
WAV PCM de 16 bits, estéreo, 48 kHz, 30 segundos cada: **28.800.220 bytes** no total.
As falas atuais são OGG/Vorbis estéreo a 48 kHz. Os seis arquivos Delícia usados
pelo catálogo são WebM/Opus estéreo a 48 kHz e também foram preservados.

Uma etapa separada pode comparar OGG/Vorbis e WebM/Opus para as músicas,
mantendo os WAV como fontes. A escolha precisa verificar decodificação nos
navegadores suportados, especialmente Safari/iOS, duração, silêncio inicial/final,
emendas de loop, volume e clipping, pausa/retomada, mute, troca de faixa e editor.
É necessária comparação auditiva humana em diferentes trechos e taxas antes de
afirmar qualidade equivalente. Não foi feita compressão, audição ou promessa de
economia para essa etapa futura.

## Perfil conservador da frente cloud — 2 de outubro de 2026

Base medida: `f4106941e97a30e9e8911f30428319d6ddb92635`, obtida de
`origin/main`, em Linux com Node `24.19.0`, npm `11.9.0` e dependências do
lockfile instaladas por `npm ci`. O checkout inicial estava limpo e um commit
atrás dessa base. Não havia `AGENTS.md` nem skills locais em `.agents/` disponíveis
nesta configuração. Esta etapa altera somente a política de empacotamento,
seus testes e esta documentação.

### Diagnóstico e mudança

O pacote tem **141 arquivos e 40.572.532 bytes**, com **4.427.468 bytes** de
margem para o orçamento de 45.000.000 bytes. Os cinco WAV clássicos representam
28.800.220 bytes (70,99%); os seis WebM, 6.346.260 bytes (15,64%). Os 31 arquivos
JavaScript somam 822.788 bytes (2,03%). Esses valores descrevem o pacote inteiro,
não os recursos baixados por uma rota específica.

A cópia fazia `mkdirSync(..., { recursive: true })` para cada asset publicado,
mesmo quando vários compartilhavam o diretório. Agora um conjunto local à chamada
evita repetir a criação do mesmo diretório: **95 chamadas antes, 9 depois**.
O conjunto não persiste entre builds; um output limpo é recriado corretamente.
As exclusões continuam sendo os mesmos 21 caminhos exatos (23.091.611 bytes).

`npm run size:build` continua retornando os campos existentes e agora acrescenta
`headroomBytes` e `byExtension` (extensão, quantidade e bytes, em ordem decrescente
de tamanho). Extensões são normalizadas para minúsculas; arquivos sem extensão
usam a string vazia. Os totais incluem todos os arquivos e mantêm o orçamento
medido em bytes decimais. Nenhum relatório é escrito em `dist/`.

Para identificar o custo da política durante um build real:

```sh
FEKA_BUILD_PROFILE=1 npm run build
npm run size:build
node --import tsx --test tests/build-output-policy.test.ts
```

A linha opcional `[feka-output-profile]` informa `copyMs`, `inspectMs` e
`headroomBytes`. Esses tempos cobrem apenas cópia e inspeção no hook `writeBundle`,
excluindo validadores, typechecks, transformação de módulos e compressão usada
pelo relatório do Vite. O log habitual e todas as proteções permanecem ativos
sem a variável de ambiente.

### Comparação local

| Medida | Antes | Depois |
| --- | ---: | ---: |
| Arquivos / bytes em `dist/` | 141 / 40.572.532 | 141 / 40.572.532 |
| Chamadas de `mkdirSync` na cópia | 95 | 9 |
| Mediana da cópia isolada, cache aquecido | 11,062 ms | 10,865 ms |
| Mediana da inspeção do fixture de cópia | 4,684 ms | 4,650 ms |
| `npm run build`, incluindo prebuild, uma execução | 13,091 s | 12,082 s |
| Build reportado pelo Vite, uma execução | 1,94 s | 1,81 s |

A sondagem isolada executou seis cópias em diretório temporário recriado, descartou
a primeira amostra e contou chamadas ao próprio `mkdirSync` do Node. A inspeção
desse fixture cobre os 95 assets publicados mais `index.html`, não os bundles.
Já o perfil do build completo atualizado mediu **13,736 ms de cópia e 16,666 ms
de inspeção** de todo o output. Não se deve comparar diretamente as duas
inspeções, pois os conjuntos de arquivos são diferentes.

Os dois typechecks da base, executados separadamente, levaram **3,032 s** e
**5,114 s**; `npm run validate` levou **1,367 s**. A evidência aponta o trabalho
de validação de tipos como o maior custo observado, e a cópia como uma parcela
pequena. As medições não sustentam atribuir a diferença de aproximadamente um
segundo do build completo à mudança de diretórios: são execuções únicas,
sujeitas a cache e variação do host. Não se removeu validação nem se alteraram
os scripts compartilhados do `package.json` para obter um resultado aparente.

Foi comparado o inventário de caminhos, tamanhos e hashes SHA-256 antes/depois:
**todos os 141 arquivos de `dist/` e todos os 116 arquivos de `public/` são
idênticos**. Não há economia de bytes nesta etapa. Os seis testes focados da
política passam, incluindo builds limpos consecutivos, reconciliação por extensão,
margem zero no limite e rejeição de excesso; validadores, typechecks e build passam.
A suíte completa dessa versão passou com **1.241 testes TypeScript e três testes
de servidor**, sem falhas.

### Limites e integração

Durante a frente chegou `bc431d5c492079a4565fe39fe96742f8dd790057`, com a bica
pós-vitória do Bairro. A branch foi rebaseada sobre esse commit, sem conflito
ou sobreposição de arquivos; essa é a **base efetiva da entrega**. O commit foi
preservado integralmente, inclusive o novo asset. A comparação foi repetida com
um worktree destacado da base, usando o mesmo lockfile e as mesmas dependências:

| Medida sobre `bc431d5` | Base sem esta mudança | Com esta mudança |
| --- | ---: | ---: |
| Arquivos / bytes em `dist/` | 141 / 40.574.974 | 141 / 40.574.974 |
| Margem para 45.000.000 bytes | 4.425.026 | 4.425.026 |
| `npm run build`, incluindo prebuild | 11,749 s | 11,853 s |
| Build reportado pelo Vite | 1,60 s | 1,66 s |

Novamente, os **141 arquivos publicados e os 116 originais** são idênticos por
SHA-256 entre a nova base e a branch. O perfil atualizado mediu **15,383 ms de
cópia e 19,855 ms de inspeção**. A ausência de ganho no build total nessa segunda
comparação reforça o limite: a melhoria é a redução de chamadas redundantes e a
visibilidade do orçamento, não uma aceleração comprovada do build completo.
Após a reconciliação, **1.248 testes TypeScript e três testes de servidor**
passaram, assim como os validadores, ambos os typechecks, o build e `size:build`.

Esta etapa não mediu navegador, rede, FPS, memória de runtime, Safari/iOS,
qualidade auditiva ou emendas de loop. Não comprimiu músicas, alterou gameplay,
arte, renderer, carregamento de runtime, Oracle ou configuração de publicação.
Não houve merge na main nem publicação. Qualquer otimização futura de áudio ou
carregamento precisa combinar propriedade com a frente de runtime e validar seus
consumidores e loops; esta mudança não depende de código de outra frente.
