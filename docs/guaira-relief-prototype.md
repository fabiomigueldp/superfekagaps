# Guaíra · Câmara de Alívio

Este documento registra a autoria e as provas do protótipo original. A Câmara agora é carregada como continuação opcional da Galeria no capítulo, sem página própria; o contrato de integração e seus testes estão em [guaira-relief-chapter-continuation.md](./guaira-relief-chapter-continuation.md). As declarações de isolamento abaixo descrevem a etapa anterior à integração.

Protótipo isolado sobre a base `5892a0e`, sem página ou entrada pública. O construtor é `GuairaRelief(canvas,status)`; não está importado por uma entrada Vite, mapa, capítulo ou campanha. A tentativa é efêmera e não lê `localStorage`.

## Lacuna e escolha de jogo

Travessia e Pátio operam apoios móveis; Respiros ensina observar ciclos; Subida transporta Feka; Prefeito combina abertura e contrapressão; Galeria transforma terreno para passagem. A Câmara une duas autoridades já conhecidas: romper um tile altera permanentemente, até a próxima reconstrução, a causa de um risco mais adiante.

Há duas soluções igualmente válidas. A rota baixa observa a grelha e atravessa durante o intervalo seco. A manutenção sobe os apoios, rompe uma tampa de alívio e volta ao corredor com a grelha despressurizada. Abrir por cabeçada a partir do apoio intermediário também é válido pelo Player nativo. Não se exige sentada específica, tampa inteira removida, bandeira, item, corrida ou dano para concluir. O capacete permite atravessar pagando um contato; essa estratégia também conclui. O resultado relata somente o estado real do alívio, sem alegar travessia segura pelo intervalo.

A água limpa retorna por um ramal de serviço visível. O resultado é **PASSAGEM INSPECIONADA**. Não se afirma que esta oficina reabriu o abastecimento público do bairro. Não há nova explicação para o suco roxo nem fruta.

## Estrutura de 640 × 384 px

Todas as medidas são de superfície/pés. Os apoios são tiles `PLATFORM` nativos, atravessáveis por baixo.

| Elemento | Limites | Função |
| --- | --- | --- |
| Piso seco contínuo | x0–640, y336 | Rota baixa e recuperação de todas as quedas |
| Entrada e bandeira | x32 / x80, y336 | Recuperação antes da escolha |
| Apoio inferior | x112–176, y288 | Primeiro salto opcional |
| Apoio intermediário | x160–288, y224 | Segundo salto e recebimento sob toda a tampa |
| Borda alta | x224–240, y160 | Aproximação sem quebrar |
| Tampa frágil real | x240–288, y160–176 | Três tiles; qualquer abertura alivia |
| Grelha nativa | x384–512, boca y336 | Coluna visível até y208 |
| Chegada | x≥592, pés y336 | Viva e apoiada; sem condição hidráulica oculta |

Sequência superior: chão → apoio288 → apoio224 → borda/tampa160 → quebra → apoio224 → chão336 → grelha desligada → saída. A cabeçada remove o salto final sobre a tampa. A borda alta já mostra o apoio224 antes de romper; esse apoio mostra o chão336 antes de sair dele. A câmera local preserva Feka abaixo do HUD e não altera física.

Um coletor de alvenaria recuado fica diretamente sob os tiles rachados. Seu tubo desce pelo centro da tampa, encontra o retorno lateral com tela e segue até a grelha. O mostrador de pressão fica na própria alimentação. Quebra real mantém a portinhola aberta, água discreta no retorno, leitura zero e grelha sem coluna, inclusive com movimento reduzido. Os tubos não têm colisão nem bordas de apoio falsas; Player, bandeira e terrenos seguem a renderização nativa.

## Ciclo e consequência

O único jato usa `jetCycle`, período4200ms, fase inicial3300ms, sem nova hitbox. O time0 tem1900ms secos e800ms de aviso antes de começar a subir. A primeira coluna não nula aparece no passo163 (2716,667ms, por rasterização nativa). A pintura ciano opaca coincide com o retângulo perigoso em todo o ciclo; névoa e água de retorno são inofensivas e usam outra apresentação.

Andando continuamente desde o spawn, o primeiro aviso começa no frame114: Feka está em x254,3, com115,7px livres entre seu corpo e a grelha. O mostrador aparece em x191,37 da tela. Soltar a direção nesse momento deixa104,975px após a frenagem nativa. O controle cego só perde o capacete no frame172, após966,667ms de aviso/coluna já apresentados. A espera na margem é segura por quantos ciclos forem necessários.

Depois de `WorldGame.update` produzir uma abertura real na tampa, o adapter observa os tiles e fecha o corpo nativo do jato no mesmo update. Desligar elimina dano imediatamente. Se havia coluna, o snapshot `jetShutdown` origina só gotas claras esparsas por300ms, sem uma falsa coluna ainda perigosa. Um teste rompe a tampa durante a descarga por inputs reais, tanto no teclado quanto no toque. Não há interação à distância, fabricação de impacto ou alteração do algoritmo compartilhado.

## Recuperação, pausa e fim

- Morrer antes da bandeira reconstrói a entrada; depois dela, reconstrói x80/pés336 com o capacete registrado pelo checkpoint
- Toda reconstrução fecha a tampa, religa o jato e volta o relógio a zero, incluindo1900ms secos mais800ms de aviso. Abrir o alívio não persiste através de morte
- `load(id)` sem resume inicia outra tentativa, limpando bandeira, resultado, relógio e comandos segurados. Não há botão novo nem modificação de navegação
- Escape, pausa, blur e aba oculta congelam simulação e exigem retomada explícita. Cancelamento de toque solta o comando
- Ambas as soluções podem recuar. A superior intacta permite desistir; após a abertura, é possível atravessar a grelha, voltar à entrada, esperar e concluir novamente sem pressão
- Ao concluir, tempo, câmera, geometria e resultado ficam fixos; idle nativo, pausa e som continuam. Disposal encerra a instância e limpa o resultado local

## Prova reproduzível

```sh
node --import tsx --test tests/guaira-relief.test.ts tests/guaira-relief-art.test.ts
node --import tsx scripts/prove_guaira_relief.ts /tmp/guaira-relief-proof
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p tsconfig.tools.json --noEmit
```

Os34 testes focados cobrem: duas rotas completas em teclado/toque × normal/reduzido; replay determinístico; cabeçada parcial; salto da bandeira;12 fases de chegada por teclado e toque, com entrada/retirada, três ciclos de espera e travessia; retorno da manutenção; quebra durante descarga; primeira aproximação e margem de frenagem; travessia válida consumindo capacete e resultado factual; dano real, morte e checkpoint; retry; interrupções; disposal; pintura da ligação, tampa parcial e estado aberto; envelope de água em todo o ciclo e render sem mutação.

O recorder gera16 traços completos (quatro rotas × teclado/toque × normal/reduzido) e hashesSHA-256. Todo avanço de rota usa eventos reais de `Input` e `update(1000/60)`, sem reposicionar Feka ou escrever resultado, tiles ou checkpoint. Frames de conclusão:

| Rota | Frame real de conclusão | Tempo da tentativa | Tampa |
| --- | --- | --- | --- |
| Manutenção por sentada | 487 | 8,117s | Aberta no frame296 |
| Intervalo da grelha | 361 | 6,017s | Intacta |
| Cabeçada nativa | 457 | 7,617s | Abertura parcial no frame244 |
| Intervalo sem bandeira | 341 | 5,683s | Intacta |

Esses tempos pertencem a inputs conhecidos; não medem primeira visita humana. Testes de morte explicitamente identificados como fixtures são separados das rotas completas. A amostragem de12 fases demonstra recuperação sob diferentes chegadas, sem alegar exaustividade matemática. As fronteiras DOM/canvas/áudio são simuladas. Imagens produzidas com WorldGame/Canvas offline não são captura de navegador, teste físico de celular ou medida de FPS.

## Limites e integração futura

Não houve alteração de engine, balanceamento de níveis existentes, Turbosuco, campanha/save/sete mundos, cinco resultados do capítulo, navegação, HTML ou configuração Vite. Não houve commit, push, deploy ou acesso Oracle. Todos os arquivos são novos e isolados. Não há texturas, dependências ou assets de runtime novos; sem importação numa entrada pública, este protótipo acrescenta zero bytes ao output atual. O bundle independente com a engine compila; a integração futura deverá medir o output publicado contra45MB e fazer inspeção visual em navegador.

Uma integração eventual precisa decidir onde esta oficina opcional é encontrada e fornecer host/controles/status acessíveis usando o contrato existente, além de verificar browser/touch físico. A escolha de rota e a abertura continuam locais; não devem criar um sexto resultado nem sugerir restauração pública de água. Nenhuma dessas integrações é parte deste protótipo.
