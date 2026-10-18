# Guaíra — fundos das oito cenas

Revisão de 17/10/2026. [Antes/depois, vídeos e pranchas](index.html).

## Diagnóstico

A rodada anterior melhorou os bairros ampliados e as passarelas, mas parte da arquitetura inicial ainda usava telhados e bases mais simples. Galeria e Alívio começavam com paredes diferentes das extensões; o friso antigo da Galeria ficava preso à tela durante movimentos verticais. O curral ainda não apresentava construções que o ligassem ao vale irrigado. Na praça do Prefeito, os postes do varal terminavam acima da alvenaria e a corrente pluvial começava abaixo do beiral.

Uma segunda inspeção, com amostragem mais densa da câmera, encontrou duas emendas adicionais: o último arrozal do Pátio era cortado pelo limite do trecho e o aterro dos Respiros terminava em uma borda vertical. As duas foram corrigidas e recapturadas antes de concluir a rodada.

## Mudanças

- **Travessia:** telhas, beirais, calhas contínuas e fundações nas casas iniciais, usando o acabamento dos bairros ampliados.
- **Pátio:** casa inicial com acabamento comum, janela e peitoril; a última margem do arrozal termina antes de x960, deixando a inclinação completa aparecer na aproximação das docas.
- **Respiros:** acabamento dos telhados e fachadas nas casas de bombas. O aterro termina em talude entre x1088 e x1152, suavizando a transição para a oficina.
- **Subida:** casas compactas e construção elevada com telhado, calha e base comuns ao restante do distrito. A inspeção percorreu também guinchos, portaria e aqueduto.
- **Galeria:** parede, friso e fundações nas mesmas coordenadas de mundo usadas pela extensão; acabamento do telhado da oficina. A parede acompanha a câmera vertical sem criar uma faixa fixa junto ao HUD.
- **Câmara de Alívio:** a entrada usa a mesma base de alvenaria da extensão e o telhado recebe acabamento comum. Sacadas, coletor, janelas e retorno continuam legíveis.
- **Ossabravo:** paiol, pequeno moinho, roda de água e canal de serviço atrás da cerca. Tons suaves e limite vertical explícito mantêm a decoração fora da faixa de combate em y174 e abaixo. A roda usa o relógio de simulação e mantém o eixo fixo.
- **Prefeito:** calhas e embasamentos nas fachadas. Postes do varal chegam à alvenaria; corrente pluvial conectada do beiral até a base de pedra. A revisão visual inclui todos os estágios do combate e a liberação da água.

`GuairaBuildingFinish` concentra telhas e arremates de fachada; o telhado extraído de `GuairaNeighborhoodArt` conserva seus pixels anteriores. `drawGuairaWorkshopWall` fornece a parede contínua dos dois interiores. Toda a arte continua no Canvas nativo de 320 × 180, com o mesmo relógio, pausa e movimento reduzido do jogo.

## Cobertura visual

| Cena | Vistas | Pranchas | Cobertura |
| --- | ---: | ---: | --- |
| Travessia | 47 | 3 | Casas, vala, eclusa, armazém e saída |
| Pátio | 56 | 4 | Comportas, arrozal, transição, passadiço e docas |
| Respiros | 47 | 3 | Bombas, talude, grelhas, oficina e cais |
| Subida | 60 | 4 | Bairro, construção elevada, guinchos, portaria e aqueduto |
| Galeria | 53 | 4 | Entrada, poço, viga alta, alçapão e desvio inferior |
| Alívio | 43 | 3 | Oficina, sacadas, retorno, coletor e contrapressão |
| Ossabravo | 16 | 1 | Arena, investidas, arcos e vitória |
| Prefeito | 64 | 4 | Arena, câmera vertical, ataques e água liberada |

São **386 vistas em 26 pranchas**, provenientes das partidas com comandos reais de jogo. O modo `GUAIRA_DENSE_SURVEY=1` salva a primeira entrada em cada célula de câmera de 144 × 72 pixels, além dos pontos regulares e especiais dos replays. A captura não reposiciona personagem, câmera ou relógio. As pranchas parciais têm células vazias no final; isso não representa tela vazia no jogo.

## Verificação

- [Comparação nativa](native-verification.json): oito conclusões sem dano, com duração, moedas e os 183 estados amostrados de personagem/câmera iguais à referência. Vídeos das entradas nas seis fases e dos combates completos, a 30 fps e sem áudio. As pranchas mostram os percursos completos.
- [Campanha normal](campaign-report.json): nove execuções com gamepad simulado; entrada pelo mapa nas oito cenas, conclusões e retorno ao Pátio opcional. Não é uma prova com controle físico.
- [Estudos de fundos no navegador](browser-report-scenes.json): 40 estudos, cobrindo oito entradas/arenas, seis transições e seis extensões, em movimento normal e reduzido. Conferem pintura sem mutação, repetibilidade e pixels/estado congelados na pausa. Esses estudos usam câmera e tempo escolhidos e estão separados das partidas nativas. Os tempos registrados medem só o pintor, sob carga de QA, não FPS do jogo inteiro.
- [Página de revisão](browser-report-review.json): oito comparações e oito vídeos decodificados em larguras de 1440 e 390 pixels; sem transbordamento horizontal.
- [Resultados consolidados](verification.json): **3.747 testes TypeScript aprovados, zero falhas e um ignorado**, além de três testes JavaScript. Validadores de fases e sprites, os dois projetos TypeScript e build aprovados.
- Treze novos casos: nove testes de continuidade, calhas, fundações, roda do moinho, limite do campo de combate, encaixes da praça e as duas margens; quatro verificações adicionais de pausa/movimento reduzido nos interiores.

## Reprodução

```powershell
node --import tsx --test tests/guaira-chapter-backgrounds.test.ts tests/guaira-backgrounds.test.ts tests/guaira-scenery.test.ts tests/guaira-scenery-joins.test.ts
npm run build

# CANVAS aponta para @napi-rs/canvas/index.js.
$env:GUAIRA_SCENES='travessia,patio,respiros,subida,galeria,alivio,lab,prefeito'
$env:GUAIRA_DENSE_SURVEY='1'
$env:GUAIRA_CAPTURE_STRIDE='2'
node --import tsx scripts/prove_guaira_chapter_readability.ts OUTPUT CANVAS

# Servidor de QA com VITE_DEVELOPMENT_UNLOCKED_SAVE=false.
$env:FEKA_UI_URL='http://127.0.0.1:3001'
$env:GUAIRA_NORMAL_CAMPAIGN='1'
$env:GUAIRA_GAMEPAD='1'
node scripts/verify_guaira_chapter_readability.cjs

$env:GUAIRA_OUTPUT='output/guaira/chapter-backgrounds-2026-10-17/browser'
$env:GUAIRA_BACKGROUND_PROFILE='chapter'
node scripts/verify_guaira_backgrounds.cjs
$env:GUAIRA_BACKGROUND_MODE='review'
$env:GUAIRA_BACKGROUND_REVIEW_PATH='/docs/world/guaira/chapter-backgrounds-2026-10-17/index.html'
node scripts/verify_guaira_backgrounds.cjs
```

Defina `PLAYWRIGHT_MODULE` quando o pacote não estiver disponível na resolução padrão. Esta revisão cobre os fundos das oito cenas 2D; não altera o modelo 3D da ilha. As provas registram os percursos inspecionados e a integração técnica, sem atribuir uma medida automática de beleza ou diversão.

Rodadas anteriores: [fachadas, apoios e composição dos distritos](../scenery-joins-2026-10-17/README.md), [paisagem distante e interiores](../backgrounds-2026-10-17/README.md).
