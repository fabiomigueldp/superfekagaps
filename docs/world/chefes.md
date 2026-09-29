# Os seis confrontos

> Registro da direção de pré-produção. A execução posterior e seus limites estão em [implementação](implementacao.md).

[Voltar à direção](README.md) · [Fichas de fases](campanha.md)

Estes são projetos de encontro, não comportamento já implementado. Tempos e número de ciclos abaixo são valores iniciais para teste. Cada revanche altera arena e solução, preservando a personalidade e parte das animações do personagem.

## Regras comuns

- Estrutura: apresentação → preparação legível → execução → recuperação/oportunidade → repetição com variação controlada → derrota cartunesca.
- Primeira execução de cada padrão é previsível. Variações posteriores escolhem entre padrões válidos, sem combinações que eliminem toda posição segura.
- Alvos são fixados durante o aviso. Um ataque não acompanha o jogador depois de anunciar onde cairá.
- Preparação de referência: 700–1000 ms; recuperação inicial: 1200–1600 ms. Ajustar pelo tempo real de deslocamento do jogador, não só pela duração da animação.
- Postura de proteção e vulnerabilidade têm desenhos diferentes, efeito discreto e som. Cor sozinha não comunica a abertura.
- Durante proteção, contato superior de um salto comum rebate sem ferir Feka; laterais continuam perigosas durante a proteção. Na implementação World, o corpo atordoado não causa dano durante a abertura; ainda é necessário aterrissar por cima para acertar. A sentada sobre proteção também rebate e não causa dano ao chefe. Isso deve ser ensinado no primeiro encontro e revisado com a física atual.
- Vulnerabilidade permite dano por pulo ou sentada. Um contato válido tira um ponto; sentada não elimina etapas inteiras. Cada abertura aceita no máximo um ponto, evitando múltiplos acertos por sobreposição.
- Erros de mecanismo não consomem uma chance finita: barris reaparecem, cargas voltam, comandos são reativados e apoios se recompõem quando necessário.
- Checkpoint imediatamente antes da arena; derrota restaura seu estado inteiro. Apresentação vista pode ser pulada. Alvo de experiência: controle devolvido em até cerca de três segundos após a animação de morte, a validar.
- Luta deve ser vencível sem itens. A aproximação oferece capacete, e o checkpoint preserva o equipamento inicial daquela tentativa conforme as regras de gameplay.
- Nenhum chefe lança projéteis enquanto uma fala ou enquadramento obrigatório impede o jogador de enxergar o ataque.
- Definir a ordem de atualização para impedir dano ao jogador por uma hitbox residual depois de um acerto que deveria encerrar a luta.

## J1 — Joãozão na ponte

**Fase:** 1-5. **Fantasia:** sobreviver à força direta e perceber que João deixa uma abertura depois do exagero. **Meta inicial:** três acertos, aproximadamente 60–90 segundos sem mortes.

### Arena e ciclo

Ponte horizontal com plataformas de pedra nas extremidades e segmentos centrais identificáveis. Existe espaço suficiente para pular o chefe sem exigir um salto no limite. Os gaps são temporários por ciclo e nunca atingem os dois apoios de segurança.

1. João ergue os braços, fixa uma área da ponte e a marca com rachadura pulsante e som grave.
2. Feka sai da marca. O impacto abre o gap anunciado; João fica curvado e vulnerável numa borda acessível.
3. Feka o alcança por pulo ou sentada. Acerto encerra a abertura e inicia recuperação neutra; erro permite esperar o próximo ciclo.
4. A ponte recompõe o segmento com animação inequívoca antes de selecionar novo ataque. Nunca materializar terreno causando dano.

### Escalada

- Antes do primeiro acerto: somente o golpe principal, com aviso mais longo.
- Depois do primeiro: João também pode fazer um salto curto de reposicionamento, com sombra de chegada; ele não abre gap nesse salto.
- Depois do segundo: alternar as duas ações e reduzir ligeiramente o descanso neutro; manter a janela necessária para alcançar a cabeça.

**Falas:** introdução completa; reação de dano com intervalo; uma provocação no descanso. Nunca repetir a apresentação a cada morte automaticamente.

**Derrota e continuidade:** João cai sentado no apoio e recua por uma escada lateral. Feka chega ao barco de serviço; venceu de verdade o bloqueio local.

**Assets adicionais:** preparação de gap, recuperação com cabeça acessível, sombra de salto, segmentos de ponte e efeito de recomposição. Reutilizar poses do remaster quando sua leitura servir ao novo ciclo.

**Verificação:** alvo não segue Feka após a marcação; ambas as extremidades não são removidas juntas; o ataque é evitável após reconhecimento; permanecer no canto não elimina todas as oportunidades nem trava o chefe.

## B1 — Mestre das cargas

**Fase:** 2-5. **Fantasia:** mudar a altura do cenário para enfrentar alguém fisicamente maior. **Meta inicial:** três acertos, 75–110 segundos.

### Arena e ciclo

Biel fica numa plataforma elevada ao centro. Dois acionadores no piso movem plataformas de apoio distintas da carga perigosa do guindaste. A carga perigosa tem cinta pontiaguda e sombra marcada; apoios têm superfície plana e borda clara.

1. Biel puxa o comando do guindaste; a carga anuncia sua descida numa área fixa.
2. Feka evita a área e usa o acionador livre. Uma plataforma sobe até uma altura intermediária estável.
3. Após o golpe da carga, Biel faz esforço para recolhê-la e perde a proteção. Feka usa o apoio elevado para alcançá-lo.
4. A carga sobe e as plataformas voltam lentamente à posição inicial, com aviso, encerrando o ciclo.

### Escalada

Após um acerto, a escolha entre esquerda e direita passa a alternar. Após dois, a plataforma segura começa em posição diferente, mas os mesmos símbolos indicam o comando correto. Não adicionar uma segunda carga letal simultânea.

**Falha recuperável:** se o jogador aciona o lado ruim, pode inverter durante o descanso ou aguardar o próximo ciclo. A plataforma nunca prende Feka contra a parte inferior de Biel.

**Derrota e continuidade:** um contrapeso levanta o assento de Biel e o deixa fora de posição. Ele desce irritado e segue pela cabine de manutenção; o caminho da fábrica fica livre.

**Assets adicionais:** puxar alavanca, esforço sustentado, surpresa, postura vulnerável e retirada; cabine, carga de perigo, apoios, cabos e polias.

**Verificação:** ambas as configurações iniciais são vencíveis; símbolos permitem associar comando e apoio; oportunidade dura o suficiente para percorrer o trajeto após reconhecer o estado.

## C1 — Controle de qualidade

**Fase:** 3-5. **Fantasia:** usar o sistema da fábrica para devolver o próprio ataque de Calabrezzo. **Meta inicial:** três acertos, 75–110 segundos.

### Arena e ciclo

Esteira horizontal entre o pedestal de Calabrezzo e um anteparo de descarte. Acionador em plataforma segura, alcançável durante todo o ciclo. Barris sempre nascem pelo arremesso visível do chefe.

1. Calabrezzo ergue um barril e assume uma pose reconhecível. O arremesso pousa no início da esteira e começa a rolar.
2. Feka usa a sentada para inverter a esteira depois do pouso. A inversão é visível nas setas e afeta o barril sem mudança instantânea de posição.
3. O barril devolvido atinge o equipamento do pedestal, desequilibrando Calabrezzo e abaixando o apoio de acesso.
4. Feka salta no chefe durante a recuperação. Depois, a esteira retorna ao estado inicial anunciado e o pedestal se recompõe.

### Escalada

Depois do primeiro acerto, um jato lateral ocupa apenas uma das rotas de aproximação, com aviso. Depois do segundo, o lado do jato alterna entre ciclos. Nunca ativar jato no acionador ou no único apoio de ataque durante a abertura.

**Falha recuperável:** barril perdido quebra no descarte, após o qual Calabrezzo prepara outro. Se o jogador devolve cedo ou tarde, pode tentar novamente sem reiniciar a arena.

**Falas e atuação:** vender o produto na introdução, posar antes do primeiro arremesso e reagir à pane. Diálogo novo usa texto e vocalização estilizada; não existe gravação de Calabrezzo neste levantamento.

**Derrota e continuidade:** equipamento para, Calabrezzo cai sentado entre embalagens e sai pelo elevador privado rumo à reserva. A produção visualmente desacelera; passagem para a serra abre.

**Assets adicionais:** erguer/arremessar barril, pose comercial, pane, recuperação; esteira reversível, pedestal móvel, barril e jato.

**Verificação:** inverter para os dois lados funciona; dois barris nunca se acumulam tornando o comando inacessível; vencer sem capacete e sem Mini Fanta é possível.

## B2 — Revanche nas alturas

**Fase:** 4-5. **Fantasia:** escolher uma rota suspensa enquanto Biel tenta controlar as conexões. **Meta inicial:** quatro acertos, 90–130 segundos.

### Arena e ciclo

Dois níveis, duas estações laterais seguras e cabine de Biel no alto. Cargas de apoio percorrem circuitos com paradas. Uma carga de perigo percorre trilho diferente e nunca é confundida com plataforma.

1. Biel indica qual linha receberá a carga de perigo. Setas de trilho e sinal sonoro antecipam sua passagem.
2. Feka aciona o desvio de uma plataforma de apoio, embarca e usa a parada para alcançar o nível superior.
3. Biel se desloca para corrigir o desvio; ao operar a cabine, fica vulnerável por uma janela longa o suficiente para o salto final.
4. Depois da oportunidade, um apoio de retorno permite descer. Os circuitos voltam à posição inicial durante uma pausa segura.

### Escalada

Primeiros dois acertos: linhas isoladas e paradas longas. Últimos dois: alternância de origem da carga perigosa e uma parada intermediária mais curta. Nenhuma plataforma muda a rota depois de Feka embarcar sem um sinal prévio.

**Diferença de B1:** o jogador planeja uma transferência entre estações e escolhe um circuito. Não basta repetir o comando e subir num elevador vertical.

**Falha recuperável:** perder a cabine leva a patamar inferior de retorno quando possível. Cargas reaparecem ciclicamente; nunca há um único transporte consumível.

**Derrota e continuidade:** Biel fica pendurado com segurança pela alça do próprio equipamento, se solta no patamar e abandona os comandos. A linha de passageiros volta a funcionar.

**Assets adicionais:** poses de operação lateral, reação suspensa, acessório de manutenção e cabine; reaproveitar núcleo do corpo e reações de B1.

**Verificação:** observar a arena sem atacar não produz configuração impossível; retorno ao piso seguro sempre existe; a câmera mostra destino e ameaça sem zoom que torne Feka ilegível.

## C2 — Reserva especial

**Fase:** 5-5. **Fantasia:** abrir a proteção do estoque e alcançar Calabrezzo usando barris pressurizados. **Meta inicial:** quatro acertos, 90–130 segundos.

### Arena e ciclo

Calabrezzo opera um pedestal protegido por placas de gelo marcado. Piso com gelo no centro e áreas secas laterais. Acionadores de roteamento ficam nas áreas secas; duas calhas direcionam os barris até alvos estruturais.

1. Calabrezzo mostra um barril com válvula e anuncia o arremesso. O barril cai num trilho contido, sem exigir rebater com o corpo.
2. Feka seleciona a calha que leva ao alvo de gelo atualmente marcado, usando o acionador de sentada.
3. O impacto pressurizado rompe a placa e libera uma plataforma de manutenção. Calabrezzo fica exposto enquanto tenta fechar a válvula.
4. Feka usa o apoio e acerta a cabeça. O sistema recompõe a placa durante intervalo sem ataques; o próximo alvo muda de lado.

### Escalada

Depois de dois acertos, um vazamento ocupa temporariamente parte do piso central. Aviso claro precede cada atividade; os comandos e uma área seca permanecem disponíveis. O vazamento descansa durante a aproximação final ao chefe.

**Diferença de C1:** roteamento para alvos e leitura de piso/pressão substituem a simples devolução pela esteira. Não aumentar o número de projéteis como única novidade.

**Falha recuperável:** alvo errado leva o barril ao descarte protegido. Novo barril aparece; placas não podem ser quebradas numa ordem que impeça acesso ao chefe. Gelo partido é efeito, não objeto com colisão aleatória.

**Derrota e continuidade:** Calabrezzo perde o equilíbrio num pequeno trecho de gelo e acaba sentado no estoque. A doca libera o caminho final; a derrota permanece cartunesca.

**Assets adicionais:** acessório de frio, barril pressurizado, placa de gelo, calhas e recuperação na válvula. Corpo base, arremesso e parte das reações vêm de C1.

**Verificação:** jogador consegue frear e acionar nos pisos secos; nenhuma reação em cadeia invisível alcança comandos; devolver todos os barris ao descarte não trava a luta.

## J2 — O grande gap

**Fase:** 6-5. **Fantasia:** usar a força que sempre dava gaps em Feka para criar seu próprio caminho até João. **Meta inicial:** quatro acertos, 110–160 segundos.

### Arena e ciclo

Dois níveis com suportes marcados, plataformas laterais permanentes e uma área central de impacto. Apenas elementos explicitamente marcados mudam. Os suportes baixam até batentes seguros, recuperando a linguagem ensinada em 6-1 e 6-3.

1. João prepara um impacto direcionado à posição de Feka. O jogador se posiciona sobre a região de um suporte e sai depois da marcação fixa.
2. O golpe baixa o suporte até o batente, criando um patamar de acesso. A região perigosa termina antes de começar a janela de aproximação.
3. João se recompõe no nível superior, vulnerável. Feka sobe pelo patamar que ajudou a criar e o acerta.
4. Um intervalo restaura a geometria do próximo ciclo com aviso, mantendo os apoios laterais permanentes.

### Escalada

- Acerto 1: ensinar a relação entre marcação e suporte; janela generosa, sem projétil simultâneo.
- Acerto 2: João se reposiciona com salto anunciado; o alvo estrutural disponível passa para o outro lado.
- Acertos 3 e 4: antes do golpe principal, uma onda de chão exige um salto simples. A onda termina antes da marcação estrutural; não sobrepor exigências incompatíveis.
- Último acerto: vem de ação normal do jogador. Pequena pausa de impacto e reação final dão peso sem retirar o golpe para uma cena.

**Diferença de J1:** posicionar o ataque constrói a rota, em vez de apenas evitar um buraco e saltar no chefe. A força de João tem consequência espacial maior, mas com regras que o jogador aprendeu.

**Falha recuperável:** golpe fora do suporte causa somente o gap temporário previsto e outro ciclo. Suporte errado não elimina a rota; há nova oportunidade. João não destrói todos os apoios nem deixa o jogador num poço sem saída.

**Falas:** reapresentar “Eu sou o namorado dela.” na abertura final; usar o combo existente num descanso entre etapas; reação curta ao dano respeita prioridade do aviso de ataque.

**Derrota:** João fica fora de combate por alguns instantes e depois aparece se recompondo na cena final. Seguir o [storyboard](lore.md#encerramento-storyboard-proposto), com **FEKA SALVOU YASMIN?**.

**Assets adicionais:** impacto estrutural, onda de chão em pixels, poses de grande esforço, suportes com batentes e final; preservar a silhueta conhecida do rival.

**Verificação:** testar todos os suportes em todas as etapas; vencer com rota que pulou as seis quartas fases; interromper/reiniciar em cada etapa restaura estado válido; não aplicar dano depois da vitória registrada.
