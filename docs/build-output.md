# Pacote de publicação

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
