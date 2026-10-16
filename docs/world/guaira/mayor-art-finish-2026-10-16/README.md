# Casa da Vazão — acabamento de arte, 16/10/2026

Esta rodada modifica a arte em produção do Prefeito. A entrada direta e a cena
do capítulo continuam usando `GuairaMayorLab`. A página `index.html` reúne
capturas e gravações dessa implementação.

## Alterações

- Bairro com telhados de barro em camadas, portas recuadas, esquadrias, sacada,
  toldos, varal, vegetação enraizada e pássaros pousados.
- Casa da Vazão com porta em arco, profundidade no vão, pilastras, fragmentos de
  azulejo, cornija e corrente de chuva. As cores do fundo são mais suaves que as
  dos atores e avisos.
- Reservatório reforçado, visor com reflexo animado, bases até o piso, juntas
  nas tábuas e roldanas cujo ângulo depende da altura real do elevador.
- Apoios desenhados atrás dos tubos, evitando cortes visuais na linha contínua
  de alimentação. Placas de reserva/bairro reposicionadas fora das plataformas.
- Rosto e roupa do chefe refinados; faixa acompanha as poses de salto. Cabeça
  e cotovelos demonstram esforço na recuperação, preservando a área do golpe,
  as botas e o carimbo preso. Após a derrota há acomodação e mudança de expressão.
- Animações decorativas leem o relógio existente. Movimento reduzido mantém
  uma pose estável, conservando os gestos funcionais do combate.

## Revisão e validação

Na primeira passagem, a cabeça do chefe subia até a faixa do golpe nas costas.
A animação foi corrigida para ficar abaixo dela. Também foi revista a ordem
de desenho dos pilares e da tubulação, além do encaixe das placas.

- **1.132 testes de Guaíra passaram**, incluindo dois novos contratos de
  animação: abertura/apoios fixos durante o esforço e pés/ferramentas fixos ao
  sentar, com pausa e movimento reduzido determinísticos.
- `npm run build`: validadores de níveis, assets do jogador, mundo (30 fases,
  260 frames), os dois projetos TypeScript e build Vite aprovados.
- Quatro percursos completos sem dano: balcão, espera, piso e interrupções.
- Antes/depois: **1.885 quadros**, mesmos golpes em **407, 1004 e 1701**;
  comparação dos eventos e posições do encontro. Código de combate e contornos
  da água idênticos aos arquivos preservados no início desta rodada.
- Navegador: percurso pelo piso e interrupções por teclado e controles DOM de
  toque simulado; nova tentativa, pausa e movimento reduzido conferidos.
- Integração: oito cenas de Guaíra concluídas pelo verificador do capítulo.
- Página em 1440 e 390 px, sem rolagem horizontal; imagens carregadas e os dois
  vídeos efetivamente decodificados, ambos com 31,416667 s, 960 × 540, 60 fps.
- Perfil local no Edge headless: 1.825 amostras após aquecimento em cada modo.
  Mediana/p95 de submissão de atualização + desenho: aproximadamente 2,2/3,9 ms
  normal e 1,6/3,3 ms com movimento reduzido. Isto **não mede FPS de aparelho
  físico**. Depois de 90 atualizações pausadas, o canvas permaneceu idêntico
  pixel a pixel em ambos os modos.

Os vídeos são sem áudio e os percursos são ensaiados. A avaliação da descoberta
das estratégias e da dificuldade com jogadores novos continua fora desta prova.

## Reprodução

Os caminhos abaixo são relativos à raiz do repositório. `CANVAS_MODULE` é o
caminho absoluto do módulo `@napi-rs/canvas`; `PLAYWRIGHT_MODULE` aponta para a
instalação local do Playwright. O navegador usa o Vite em localhost:3000.

```powershell
$guairaTests = @(rg --files tests -g 'guaira-*.test.ts')
node --import tsx --test --test-reporter=tap @guairaTests
npm run build

$env:GUAIRA_MAYOR_PROOF = 'crosscurrent'
node --import tsx scripts/prove_guaira_mayor_rework.ts OUTPUT_AFTER CANVAS_MODULE
node --import tsx scripts/prove_guaira_mayor_rework.ts OUTPUT_BEFORE CANVAS_MODULE docs/world/guaira/mayor-art-finish-2026-10-16/baseline-source
node --import tsx scripts/prove_guaira_mayor_art_poses.ts OUTPUT_POSES.png CANVAS_MODULE

$env:GUAIRA_MAYOR_EXTRA_ROUTE = 'tests/helpers/guairaMayorInterruptReplay.json'
$env:GUAIRA_MAYOR_REVIEW_PATH = '/docs/world/guaira/mayor-art-finish-2026-10-16/index.html'
$env:GUAIRA_MAYOR_VIDEO_COUNT = '2'
node scripts/verify_guaira_mayor_rework.cjs
```

As imagens de cada quadro são ampliadas por vizinho mais próximo ao codificar
os vídeos. O código anterior em `baseline-source/` é exclusivamente uma
referência para comparação; não participa da importação do jogo.

`verification.json` contém hashes dos arquivos e os resultados consolidados.
As provas completas estão em `native-verification.json`,
`baseline-native-verification.json`, `browser-verification.json`,
`review-browser-verification.json` e `render-profile.json`.
