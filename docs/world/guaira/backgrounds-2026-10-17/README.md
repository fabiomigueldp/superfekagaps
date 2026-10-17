# Guaíra — fundos, arquitetura e profundidade

Revisão de 17/10/2026. [Comparação visual e seis vídeos](index.html).

## Diagnóstico

Percorremos as oito cenas com os replays existentes e inspecionamos os quadros do renderizador nativo. Nos distritos ampliados, a paisagem externa dependia quase só de morros, árvores e casas repetidas. Os interiores tinham uma parede uniforme com linhas horizontais e poucas janelas. Na Travessia, a troca do perfil `village` para `rice` no limite da extensão criava uma descontinuidade no horizonte e chegava a mostrar dois sóis. Os arcos do aqueduto tinham geometria de escoras em V, sem uma abertura coerente de alvenaria.

## Construção da revisão

- **Quatro fases externas:** uma terceira camada de distância, com conjuntos de casas, oficinas, moinhos, pomares e campos irrigados. A composição tem um ciclo de 2.048 pixels na camada distante, equivalente a aproximadamente 4.452 pixels de percurso. Cada edifício, árvore, fundação e canal compartilha a mesma transformação de câmera.
- **Galeria:** vãos recuados de larguras variadas, ferramentas presas aos painéis, luz pelas janelas, encaixes de madeira e fundações discretas. A parede acompanha a câmera vertical; não se recompõe em cada tela.
- **Alívio:** vãos em tons de pedra e oliva, venezianas, ventiladores e conduítes fechados distinguem o setor hidráulico. Os novos detalhes não apresentam registros falsos nem reutilizam a cor dos jatos danosos.
- **Aqueduto:** arcos com aduelas radiais, pedra central, pilares completos e pés numa fundação comum. As aberturas preservam a paisagem atrás da construção.
- **Continuidade e polimento:** o céu da Travessia conserva o mesmo perfil dos dois lados da emenda. Um batente de alvenaria faz a transição para a extensão das oficinas. Duas janelas antigas da Galeria foram removidas por atravessarem os novos recessos.
- **Animação:** rodas de moinho com eixo fixo, reflexos nos canais e copas discretas usam o relógio da simulação. O mesmo instante reproduz os mesmos pixels; pausa e movimento reduzido suspendem a animação decorativa.

Os trechos introdutórios mantêm suas estruturas e os exteriores recebem a nova camada distante. Os dois chefes foram incluídos no levantamento: seus fundos ficaram idênticos à referência. Esta rodada não altera física, colisão, distribuição de inimigos ou regras de progressão.

## Rodadas de inspeção

1. Levantamento anterior das oito cenas, incluindo 16 pontos regulares por cena e os quadros especiais já existentes.
2. Primeira composição: inclusão da paisagem distante e das oficinas. Conferência da silhueta dos atores, perigos e apoios.
3. Segundo acabamento: reconstrução dos arcos, retirada das janelas sobrepostas e animação discreta dos reflexos. Nova execução dos mesmos comandos.
4. Captura final dos seis percursos, estudos de pausa no navegador e campanha normal pelo mapa.

## Evidências

- [Comparação nativa](native-verification.json): seis percursos completos; posições, câmera, moedas, avisos e conclusão iguais à referência; nenhuma edição de personagem ou relógio na captura das partidas.
- [Resultados consolidados](verification.json): build e validadores; 3.719 testes TypeScript aprovados, zero falhas, um opcional ignorado; três testes JavaScript aprovados.
- Vinte testes novos verificam translação de fundos, encaixes e fundações, abertura do aqueduto, céu contínuo, renderização sem mutação, pausa e movimento reduzido nos distritos ampliados.
- Campanha normal: nove execuções com gamepad simulado, percorrendo as oito cenas e os dois chefes, com chegada pelo mapa. Não é uma medição em controle físico.
- Os estudos de fundo no navegador usam câmera e relógio escolhidos para comparar pixels; estão identificados separadamente das partidas. O tempo medido nesses estudos pertence apenas ao pintor de fundos, não representa FPS do jogo inteiro.

## Reprodução

```powershell
node --import tsx --test tests/guaira-backgrounds.test.ts tests/guaira-scenery.test.ts
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
node scripts/verify_guaira_backgrounds.cjs
$env:GUAIRA_BACKGROUND_MODE='review'
node scripts/verify_guaira_backgrounds.cjs
```

As inspeções comprovam continuidade visual, funcionamento e repetibilidade dos percursos. A qualidade percebida de uma primeira exploração depende também de partidas humanas.
