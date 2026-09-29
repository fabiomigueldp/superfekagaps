# Revisão de fases, inimigos e combates

A revisão responde ao problema da primeira versão: um piso quase contínuo deixava mecanismos opcionais e pouca diferença entre as construções. Os 24 percursos foram reescritos; os IDs de fases, selos e progresso permanecem compatíveis.

## Construção e ritmo

| Mundo | Construção | Decisão de movimento |
| --- | --- | --- |
| Costa dos Gaps | falésias, pontes com cordas, praia inferior, farol | avançar por cima ou recuperar por baixo; distinguir madeira instável de terreno seguro |
| Porto do Bielzão | contêineres em alturas diferentes, docas, guindastes | embarcar em plataformas de carga e ativar elevadores para vencer paredes altas |
| Fábrica de Suco | tanques com superfície utilizável, linhas de envase, tubulação | ler pressão, cruzar esteiras e aproveitar apoios entre zonas de risco |
| Serra Suspensa | estações, rochedos estreitos, cabos e mirantes | planejar chegada às cabines, transferências e subida por contrapesos |
| Reserva Gelada | câmaras frias, pistas elevadas de gelo, tubulação | frear antes da borda, esperar jatos e usar barris contra alvos |
| Domínio Pizzarino | arcos, jardins em níveis, fornos, bandeiras e muralhas | combinar as habilidades anteriores em trechos curtos separados por apoios seguros |

As fases têm de duas a três áreas de retomada quando necessário. Pontos altos e rotas secundárias recebem selos; moedas indicam aproximações e aterrissagens. Existem desvios recuperáveis nas primeiras travessias. Percursos posteriores têm quedas definitivas, sempre com terreno visível na aproximação.

A câmera antecipa a direção horizontal. Na vertical, conserva uma faixa de movimento durante o salto e reenquadra ao pousar ou ultrapassar os limites dessa faixa. Isso evita acompanhar cada oscilação do personagem.

## Inimigos

- **Operário:** nova silhueta, colete e capacete. Um pisão remove a proteção e o atordoa; outro derrota. Sentada derrota diretamente. O capacete tem animação de desprendimento.
- **Investidor:** mira apenas um alvo próximo no mesmo nível, anuncia a direção, compromete-se com a investida e descansa. Interrompe a corrida em paredes e bordas.
- **Carregador:** ergue o barril, fixa a direção e lança em arco. Tem preparação e recuo próprios.
- **Guarda dos cabos:** deslocamento de ida e volta, suspensão desenhada, pausa de antecipação ao inverter o sentido.
- **Agitador:** sinaliza, gira e descansa. A colisão das pontas das pás corresponde à extensão desenhada; o motor pode ser atingido na pausa.

Os quadros das cinco famílias estão no atlas. O minion original permanece; os novos inimigos deixaram de ser apenas alterações do sprite dele. Os estados de morte têm uma saída curta em vez de desaparecer instantaneamente.

## Combates

- **João na ponte:** alterna gaps com salto anunciado por sombra depois de receber dano. A posição de pouso não segue Feka após o aviso.
- **João final:** mantém os impactos nos suportes e a onda baixa nas etapas finais. Impactos e abertura usam efeitos distintos.
- **Biel no porto:** depois do primeiro dano, lança duas cargas em posições anunciadas. Os apoios são rearmados entre acertos.
- **Biel na serra:** a varredura tem indicação de direção e região no chão. Um dos apoios precisa ser reativado a cada nova etapa.
- **Calabrezzo:** acrescenta um segundo arremesso com preparação visível após perder vida. Na primeira luta, a esteira é rearmada; na revanche, continua alternando o alvo de gelo exigido.
- Aberturas limpam barris do chefe. Acertos têm uma pequena pausa de impacto, reação corporal e partículas. A derrota tem uma animação antes da tela de conclusão; perigos residuais não retiram a vitória.

## Arquivos para revisão

- [Panoramas dos 24 percursos](capturas/percursos/index.html), exportados da geometria e arte reais.
- [Galeria com animações dos inimigos](capturas/index.html).
- [Verificação do navegador](capturas/verification.json).
- [Execução dos seis combates](capturas/combate.json).

## O que a verificação cobre

A auditoria geométrica usa o Player e as colisões reais para testar saltos locais entre superfícies, e modela as ligações de transporte e o acesso aos acionadores. Ela encontrou uma travessia excessiva no porto, corrigida com um apoio intermediário. A auditoria não simula uma pessoa completando as 24 fases nem garante que todos os segredos sejam intuitivos.

Os combates são iniciados individualmente e usam comandos comuns simulados, sem mudanças na vida, invencibilidade ou teletransporte durante a luta. O navegador verifica interface, pausa, salvamento, edição e toque. As panorâmicas e capturas são material de inspeção, não evidência de partidas completas.

Diversão, curva de dificuldade e descoberta de segredos ainda exigem sessões observadas com jogadores. Esta revisão altera efetivamente as construções e os comportamentos; não trata contagem de quadros ou aprovação de testes como certificação de acabamento artístico.
