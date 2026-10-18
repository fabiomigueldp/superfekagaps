# Guaíra — fachadas, passarelas e encaixes

Revisão de 17/10/2026. [Comparação das seis fases e vídeos](index.html).

## Diagnóstico

A rodada anterior estabeleceu a paisagem distante e os interiores. Nesta passagem, a inspeção dos percursos encontrou dois problemas na camada próxima: casas e árvores carimbadas a cada 192 pixels, sem considerar toda a largura do terreno, e apoios de passarela que terminavam na altura nominal do distrito, mesmo sobre um canal aberto. A seleção de um suporte a cada três blocos também deixava conjuntos incompletos. Nos desvios, algumas bandeirolas começavam abaixo da viga sem peça de fixação.

## Mudanças

- **Composição:** 22 posições escolhidas nas quatro fases externas, sendo 14 edifícios e oito árvores. Os edifícios têm toda a fundação apoiada em terreno sólido. A oficina elevada da Subida usa o piso real em y96; as demais construções seguem suas margens.
- **Casas:** porta recuada, toldo ancorado, janela com venezianas, vasos e pássaro com os pés na cumeeira. Uma casa acompanha a portaria da Subida.
- **Armazéns:** portas de tábuas, travessas, trilho e ferragens, fardos junto ao embasamento. As posições acompanham os trechos de trabalho e as docas.
- **Casas de bombas:** ventilador de quatro pás dentro de grade e eixo fixos, venezianas e conduítes presos à parede. Identificam a rede hidráulica sem criar novos registros interativos.
- **Acabamento comum:** telhado em terracota, beiral completo, calha de canto, abraçadeiras, reboco e fundação de pedra. As cores permanecem recuadas em relação às plataformas e aos inimigos.
- **Passarelas:** travessa sob a tábua, pilares nas extremidades, ferragens e mãos-francesas. Cada pé procura a primeira alvenaria sólida abaixo da própria coluna. Sobre um canal aberto, a estaca continua abaixo do cenário; não recebe uma sapata flutuante.
- **Câmera:** a seleção recupera o comprimento inteiro da plataforma, inclusive quando uma extremidade está fora da tela. Os apoios conservam a posição ao atravessar os limites da câmera.
- **Rotas especiais:** as tábuas frágeis conservam suas aberturas. O passadiço em balanço da eclusa mantém a estrutura própria. Bandeirolas se ligam à viga com um pequeno suporte aparafusado.

O relógio de simulação governa ventiladores, toldos, pássaros e copas. A pausa congela os pixels; o modo de movimento reduzido conserva a pose. A nova arte usa os mesmos pintores Canvas e a resolução nativa de 320 × 180.

## Inspeção e polimento

1. Captura de referência das oito cenas, com 16 pontos regulares por cena e os quadros especiais dos replays existentes.
2. Substituição da repetição automática por composição local e reconstrução dos apoios, seguida de nova passagem pelas oito cenas.
3. Revisão visual das margens e das fachadas: correção da altura da oficina elevada e inclusão da casa na aproximação da portaria da Subida.
4. Captura final dos seis percursos, conferência dos mesmos estados e execução da campanha normal pelo mapa.

## Evidências

- [Comparação nativa](native-verification.json): seis partidas completas, sem dano, com posições, câmera, moedas e conclusão iguais à referência. Os vídeos são trechos dessas partidas a 30 fps, com física a 60 Hz; personagem, câmera e relógio não foram editados durante as partidas.
- [Resultados consolidados](verification.json): 3.734 testes TypeScript aprovados, zero falhas e um opcional ignorado; três testes JavaScript aprovados. Validadores, dois projetos TypeScript e build aprovados.
- Quinze testes novos verificam toda a largura das fundações, continuidade das armações ao mover a câmera, ausência de suportes fixos nas tábuas frágeis, estacas sobre canais, altura real de degraus e integridade das fachadas durante a animação.
- [Campanha normal](campaign-report.json): nove execuções com gamepad simulado, percorrendo o mapa e as oito cenas, incluindo os dois chefes e o retorno ao Pátio opcional.
- [Estudos no navegador](browser-report-scenes.json): seis cenas em movimento normal e reduzido, totalizando 12 estudos; desenho sem mutação, repetibilidade, pixels e estado durante a pausa. Esses estudos usam câmera e relógio escolhidos e estão separados das partidas. O tempo medido é somente do pintor de fundos, sob carga de QA concorrente; não representa FPS do jogo completo.
- [Página de revisão](browser-report-review.json): imagens, seleção das seis fases e decodificação dos seis vídeos em duas larguras de tela. Os fundos dos chefes também foram comparados pixel a pixel com a referência da rodada.

## Reprodução

```powershell
node --import tsx --test tests/guaira-scenery-joins.test.ts tests/guaira-backgrounds.test.ts tests/guaira-scenery.test.ts
npm run build

# CANVAS aponta para uma instalação de @napi-rs/canvas/index.js.
$env:GUAIRA_SCENES='travessia,patio,respiros,subida,galeria,alivio'
$env:GUAIRA_CAPTURE_STRIDE='2'
node --import tsx scripts/prove_guaira_chapter_readability.ts OUTPUT CANVAS

# Servidor de QA com VITE_DEVELOPMENT_UNLOCKED_SAVE=false.
$env:FEKA_UI_URL='http://127.0.0.1:3001'
$env:GUAIRA_NORMAL_CAMPAIGN='1'
$env:GUAIRA_GAMEPAD='1'
node scripts/verify_guaira_chapter_readability.cjs

$env:GUAIRA_OUTPUT='output/guaira/scenery-joins-2026-10-17/browser'
$env:GUAIRA_BACKGROUND_PROFILE='joins'
node scripts/verify_guaira_backgrounds.cjs
$env:GUAIRA_BACKGROUND_MODE='review'
$env:GUAIRA_BACKGROUND_REVIEW_PATH='/docs/world/guaira/scenery-joins-2026-10-17/index.html'
node scripts/verify_guaira_backgrounds.cjs
```

Em instalações sem Playwright global, defina `PLAYWRIGHT_MODULE` para o pacote disponível. As verificações conferem construção visual e integração; a apreciação dos cenários durante uma primeira exploração continua sendo uma avaliação humana.
