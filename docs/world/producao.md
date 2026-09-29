# Produção e critérios de qualidade

> Registro da direção de pré-produção. A execução posterior e seus limites estão em [implementação](implementacao.md).

[Voltar à direção](README.md)

## Estado desta entrega

Pré-produção documental. As 30 fases têm fichas de intenção e os seis encontros têm ciclos definidos, mas nenhum deles foi implementado, jogado ou certificado por este trabalho. Novos nomes, ocupações e designs são propostas identificadas na direção. “Definido no documento” não significa “validado no controle”.

Esta etapa entrega sete documentos: direção, lore, campanha, gameplay, chefes, arte/áudio e produção. O trabalho seguinte transforma as hipóteses em protótipos e assets revisáveis.

Verificação da entrega documental em 29/09/2026: 30 IDs de fases, seis encontros, três descrições de selos em cada um dos 24 percursos, seis saídas secretas e 31 links locais dos documentos conferidos, sem referências ausentes. `npm run check` passou com 92 testes (89 do jogo/editor e três do placar), validação das três fases atuais e dos sprites do jogador, typecheck e build. Essas verificações cobrem a documentação e a base existente; não validam a jogabilidade das fases propostas.

## Base técnica observada

Levantamento feito no código disponível em 29/09/2026. Verificar novamente antes de implementar, pois o projeto pode continuar evoluindo.

| Área | Situação atual | Evolução necessária para World |
| --- | --- | --- |
| Campanha | [Índice](../../src/data/levels/index.ts) registra três fases em sequência | catálogo de fases por ID e conexões de mapa independentes da ordem dos arquivos |
| Fluxo | [Game](../../src/game/Game.ts) avança um índice ao concluir a fase | conclusão com ID de saída, retorno ao mapa e desbloqueios derivados |
| Dados | [LevelData](../../src/types.ts) tem objetivo único, inimigos e gatilhos | saídas identificadas, objetos de mecanismo, IDs persistentes e encontro de chefe |
| Chefes/inimigos | catálogo com minion e João; carregamento trata ambos especificamente | registro de famílias e encontros, separando personagem do variante de luta |
| Colisão | tiles sólidos/atravessáveis, dinâmicos e corpo do jogador | apoio móvel, movimento relativo, interações com cargas e barris |
| Arte | paleta, atlas, materiais e fundos separados; grade nativa | seis kits de aparência, novos atores/estados e objetos animados com origem consistente |
| Áudio | música por estado, efeitos procedurais, diretor de falas do João | temas por mundo/encontro, eventos contextuais e modo de vocalização com texto |
| Persistência | [ScoreManager](../../src/game/ScoreManager.ts) guarda recordes; editor salva fases | save próprio de campanha, checkpoints estáveis, selos e saídas |
| Editor | geometria, objetos, gatilhos, temas e serialização | edição e prévia de rotas de objetos, pares de mecanismos, saídas e dados dos encontros |
| Placar | campanha linear atual tem placar próprio | manter resultados World separados; regras online novas não são pré-requisito |

O remaster fornece a base de produção visual e várias peças de gameplay. Não assumir que plataformas móveis, grafo de campanha ou fala estilizada já existem apenas porque há editor e sistema de áudio.

## Contratos de dados propostos

São formas conceituais para orientar a implementação; não são interfaces TypeScript já adicionadas.

- **Campanha:** `campaignId`, versão, mundos, nós por ID de fase e conexões condicionadas a conclusões/saídas. Referências validadas e nenhum ID dependente da posição num array.
- **Saída de fase:** ID, tipo normal/secreta, posição e condição. Resultado da fase informa exatamente qual saída foi alcançada.
- **Objeto de mecanismo:** ID, família, posição, trajetória/limites, estado inicial, comandos associados e política de restauração. Coordenadas documentadas explicitamente; o editor atual mistura tiles para objetos e pixels para regiões.
- **Encontro:** `encounterId` como J1/C1/B1/B2/C2/J2, personagem, arena, referências a objetos e configuração de etapas. A identidade de João não é outro tipo de inimigo a cada revanche.
- **Selo:** ID estável por fase e índice local; uma coleta já registrada não duplica recompensa.
- **Save:** versão de schema, versão de campanha, conquistas, retomada e configurações. Migração ou retorno seguro definidos antes de mudar IDs publicados.
- **Fala:** personagem, texto, emoção, modo gravado/vocalizado, evento, prioridade e regras de repetição. Fonte gravada referencia uma entrada de áudio; vocalização referencia um banco de unidades.

Normalizadores devem permitir abrir as fases atuais no editor durante a transição. Sistemas World não podem exigir que todas as fases antigas ganhem saídas secretas, selos ou mecanismos. A separação entre campanhas precisa manter suas regras de vidas, tempo e placar explícitas.

## Ordem de produção e entregas

### P0 — Direção documentada

**Entregue nesta etapa:** escopo, mapa de progressão, 30 fichas, seis encontros, proposta de lore, inventário e critérios. Conferir links, contagens e dependências internas. Registrar correções futuras no documento responsável e nas fichas afetadas.

### P1 — Base jogável e referência visual

**Entrega concreta:** laboratório local com trecho de costa em formas simples; duas telas da fábrica como cena visual; estudos de silhueta de Biel e Calabrezzo; amostras curtas de vocalização.

1. Medir salto andando/correndo, altura, tempo de voo, parada e sentada com o código atual.
2. Construir um elevador, uma esteira, um acionador e um barril isolados. Testar transporte relativo e reversão antes de combiná-los.
3. Desenhar o quadro de referência da fábrica na grade real; integrar atores e uma interação no renderizador.
4. Ouvir as seis falas existentes; comparar dois tratamentos de vocalização original para texto novo.
5. Jogar os exemplos com teclado e toque. Ajustar geometria e tempos, registrando o motivo da mudança.

**Critério para avançar:** a cena mantém legibilidade em movimento; os quatro objetos funcionam sem atravessamentos ou bloqueios; movimento tem medidas reproduzíveis; timbre das vozes é coerente e não cansa num trecho repetido. Não produzir folhas completas de todos os personagens antes dessa revisão.

### P2 — Um mundo completo: Fábrica de Suco

**Entrega concreta:** 3-1, 3-2, 3-3, 3-4 e 3-5 integradas a um mapa local de teste, com 12 selos, uma saída secreta, atalho, save e C1. O mundo pode ser aberto diretamente para revisão, sem simular que a campanha inteira já existe.

Implementar carregador, agitador, pressão e interação do chefe a partir da base P1. As cinco fases precisam validar a curva de ensino inteira, inclusive a rota que pula 3-4. Usar arte e áudio da referência, expandindo apenas os assets necessários ao mundo.

**Critério para avançar:** os dois percursos até C1 são válidos; save/retomada preservam conquistas; iniciante entende os avisos; chefe é vencível sem itens; nenhuma combinação de mecanismos deixa a fase insolúvel; o conjunto sustenta a direção visual.

### P3 — Entrada da campanha e primeiro encontro com cada personagem

**Entrega concreta:** M1 e M2 completos, ligados a M3; mapa do arquipélago, abertura, J1 e B1. Revisar a curva desde um save vazio: o mundo de referência M3 agora precisa funcionar como terceiro mundo, não como tutorial isolado de tudo.

**Critério para avançar:** jogador novo aprende corrida/sentada/transporte sem conhecimento do projeto; aparições de João sustentam a rivalidade; ações específicas do editor têm prévia e serialização; coletas e atalhos funcionam nas três ilhas.

### P4 — Revanches e final

**Entrega concreta:** M4, M5, M6, B2, C2 e J2; encerramento, créditos e retorno ao mapa. Produzir kits de serra, reserva e domínio conforme cada mundo ficar jogável.

**Critério para avançar:** cada revanche exige decisão diferente do primeiro encontro; campanha comum e campanha com todos os atalhos chegam ao final; continuar após o final permite completar o que faltou.

### P5 — Revisão completa e acabamento

**Entrega concreta:** campanha integral revisada, opções de áudio/tremor, galeria de selos, cenas puláveis e persistência robusta. Exportação/importação de save pode ser concluída aqui.

Revisar dificuldade com sessões observadas, arte na resolução nativa, áudio em contexto, performance nas máquinas/dispositivos-alvo e regressões. Fazer ajustes onde houver evidência de problema; não aumentar conteúdo para compensar uma mecânica fraca.

**Critério de lançamento:** cumprir a matriz abaixo, resolver bloqueadores e registrar limitações de dispositivos efetivamente testados. Placar online específico de World pode ser uma entrega posterior.

## Matriz de qualidade

| Área | Evidência necessária | Bloqueador de conclusão |
| --- | --- | --- |
| Movimento | trajetórias medidas, jogo normal em teclado/toque, gravação de erro e recuperação | comando perdido, colisão inconsistente, sentada travada |
| Plataformas | testes de apoio vertical/horizontal, bordas, tetos e mudança de direção | atravessar apoio, teletransporte, aprisionamento sem saída |
| Fase | percurso completo, desvio de cada selo, morte/retomada nos checkpoints | salto cego obrigatório, estado insolúvel, progresso impossível sem item |
| Chefe | vitória sem itens, erro de cada mecanismo, reset em todas as etapas | ataque inevitável, abertura inalcançável, arena esgotada ou dano após vitória |
| Ensino | sessão de alguém que não recebeu a solução | regra obrigatória só é descoberta por mortes sem explicação visível |
| Mapa | caminho comum, seis atalhos, retorno após final | conexão errada, fase inacessível, chefe pulado indevidamente |
| Save | recarga em mapa/checkpoint/chefe/final, dados inválidos e armazenamento indisponível | perda silenciosa de conquista, duplicação, save de outra campanha sobrescrito |
| Arte | captura nativa, ampliada e em movimento, comparação entre mundos | apoio confundido com fundo, ator ilegível, pose incompatível com colisão |
| Áudio | audição conjunta de música/vozes/efeitos, pausa e skip | aviso mascarado, fala atrasada de outra cena, clique em loop ou sobreposição excessiva |
| Acessibilidade prática | texto legível, pistas além da cor, volume de voz separado e tremor reduzido | informação necessária só em áudio ou em diferença sutil de cor |
| Performance | medição nos ambientes-alvo com cena carregada | quedas persistentes que alterem precisão ou acumulem simulação |
| Editor | salvar/reabrir/exportar/importar cada família nova com mesmas propriedades | edição perde saídas, trajetória, IDs ou ligação entre mecanismos |

Meta de fluidez: simulação a 60 Hz e apresentação estável na máquina de referência, sem perdas persistentes do orçamento de aproximadamente 16,7 ms por quadro. Definir e registrar a máquina/dispositivo-alvo antes de declarar que passou. A documentação não inventa medição de desempenho.

## Plano de testes que acompanha a implementação

Adicionar testes automatizados para regras que podem quebrar silenciosamente, não para validar gosto visual:

- Grafo: referências válidas, seis chefes obrigatórios, saída secreta abre a ligação correta e quartas fases continuam acessíveis.
- Save: IDs únicos, coletas idempotentes, retomada canônica, migração e separação das campanhas.
- Colisão móvel: apoio transporta jogador uma vez por tick; mudança de direção, teto, salto de desembarque e origem negativa.
- Mecanismos: estados reversíveis, geração de novo barril, alvo fixo após aviso e reinício determinístico de encontro.
- Áudio: skip cancela fila, unidades não se acumulam, pausa/transição não deixam falas órfãs.
- Conteúdo/editor: serialização preserva dados e validadores rejeitam referências faltantes ou saídas fora dos limites.

Executar as regressões exigidas pelo projeto (`npm run check`) nas alterações de implementação. Para esta entrega documental, cumprir também a verificação prevista no README, além de conferir links e escopo dos documentos. Testes automatizados não substituem observação de jogadores nem inspeção de assets em movimento.

## Sessões de jogo observadas

No mundo de referência e depois na campanha completa, buscar ao menos três pessoas sem familiaridade com as soluções, incluindo uso de toque quando esse for um dispositivo-alvo. É uma rodada qualitativa inicial, não uma certificação estatística.

Registrar por trecho: onde a pessoa parou, o que tentou, motivo percebido da morte, tempo de repetição, descoberta de pistas e incômodo com vozes. Perguntar depois do trecho, evitando ensinar a solução durante o teste. Um bloqueio reproduzível exige correção mesmo que os demais jogadores passem.

## Riscos concretos e respostas

| Risco | Resposta de produção |
| --- | --- |
| Trinta fases excedem a capacidade de produzir arte própria | construir um mundo completo primeiro; reutilizar famílias coerentes e cortar detalhes redundantes antes de multiplicar conteúdo |
| Plataformas móveis exigem mudanças delicadas na colisão | laboratório P1 e testes de movimento relativo antes de construir o porto |
| Chefes só funcionam na situação ideal | testar intencionalmente erros, espera indefinida, comandos na ordem ruim e reset de cada etapa |
| Humor fica explícito demais | revisar storyboard sem legenda explicativa; manter texto final estabelecido e relações coerentes |
| Falas divertidas cansam após várias mortes | contexto, histórico, intervalos e introdução pulável; ouvir tentativas repetidas |
| Novas regras de vidas/tempo mudam demais a identidade | tratar como proposta World e avaliar em P2/P3, preservando regras e placar da campanha original |
| Detalhes pessoais de Biel/Calabrezzo mudam depois | concluir silhuetas e função antes do acabamento; separar visual base de equipamento do encontro |

## Pontos abertos, com padrão provisório

| Ponto | Padrão para trabalhar | Quando revisar |
| --- | --- | --- |
| Aparência e bordões pessoais de Biel/Calabrezzo | silhuetas e ocupações desta direção; textos novos marcados como fictícios | antes das folhas finais e gravações |
| Novas vozes: gravação ou síntese | comparar amostras curtas no jogo | P1 |
| Dano em um golpe sem capacete | preservar como hipótese inicial, com retries ilimitados | sessões P2/P3 |
| Distâncias e duração das aberturas | medir movimento e usar tempos iniciais das fichas | P1 e cada chefe |
| Nomes das regiões e dos selos | nomes desta versão; “Fábrica de Suco” fixo | antes de lettering e diálogos finais |
| Compatibilidade de dispositivos | teclado e toque; registrar hardware real de teste | P1 e P5 |

Esses pontos não impedem a pré-produção e não exigem repetir pedidos de permissão para o trabalho já autorizado. Uma correção do autor prevalece sobre o padrão provisório.
