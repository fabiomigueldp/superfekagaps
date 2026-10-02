# Galeria → Câmara de Alívio no capítulo

Continuação limitada do desvio opcional do Bairro da Vala Seca. Depois de chegar vivo ao patamar de inspeção da Galeria, o botão **ALÍVIO** e o status nomeiam a Câmara de Alívio. A entrada depende de outro acionamento explícito. Se a Galeria estiver pausada, **CONTINUAR** primeiro retoma a mesma Galeria.

A Câmara conserva o Player, capacete, checkpoint, grelha, tampa, câmera e duas soluções nativas do protótipo revisado. A orientação explica o intervalo seco, o salto seguido de baixo para abrir o alívio e a reconstrução local ao morrer ou tentar outra vez. A conclusão relata o estado real: **alívio aberto** ou **alívio intacto**. Não exige quebrar a tampa nem conservar o capacete, não afirma travessia sem dano e não cria consequência para o abastecimento público.

**TENTAR** reconstrói a sala atual, inclusive após falha no carregamento ou na montagem da Câmara. **BAIRRO** abandona qualquer sala e retorna internamente à maquete no Bairro, com foco na ação local. Uma nova entrada pela maquete começa outra Galeria. **RETOMAR** continua caminhando para o trecho obrigatório que estava selecionado, mesmo quando ele é uma repetição concluída diferente da recomendação.

## Autoridade e descarte

`GuairaChapterExcursions` fornece uma identidade tipada `gallery | relief`, presente no token imutável de cada tentativa e no runtime da fábrica. Cada transição e retry cria outro token e revisão de navegação. O owner descarta a sala anterior, seus comandos, áudio, controles, observers e RAF antes de chamar a fábrica seguinte. Uma fábrica que devolva a sala errada falha com recuperação local; importações antigas e construções reentrantes não substituem a tentativa mais recente.

O botão primário recebe uma autorização vinculada à ação apresentada. Trocar pausa/retomada/conclusão, perder foco, ocultar a página ou descartar a view invalida o callback anterior. Um clique iniciado antes de ALÍVIO aparecer não entra na Câmara; Enter repetido continua bloqueado. Ao terminar um carregamento interrompido, a sala fica pausada até retomada explícita.

Não há alteração de Session, registro dos trechos obrigatórios, geometria da caminhada, saves, badges, destinos permanentes, HTML ou entradas Vite. Os cinco recibos e a seleção obrigatória são preservados exatamente. A página independente da Galeria e seus links do mapa livre mantêm o endpoint existente; só este owner do capítulo oferece a continuação. A Câmara não recebe página independente.

## Verificação focada

```sh
node --import tsx --test tests/guaira-chapter-host.test.ts tests/guaira-chapter-excursion-native.test.ts
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p tsconfig.tools.json --noEmit
```

Resultado local: **60 testes aprovados**, sendo58 de ownership e2 jornadas nativas já existentes com suas transições opcionais estendidas. As duas checagens TypeScript passaram.

Os testes de ownership usam resultados explicitamente simulados para exercitar0/5,1/5 e5/5, identidade dos recibos e seleção retida. Cobrem factories atrasadas/reentrantes, callback antigo, Enter/pressão segurados, morte, pausa, blur/visibilidade, montagem interrompida, falhas de import/constructor/toolbar/bitmap/controles e recuperação na sala correta.

As jornadas nativas usam eventos reais de teclado ou dos botões de toque do capítulo e `update(1000/60)` sobre Player e mecanismos reais, sem escrever posição, tiles, checkpoint, flags de conclusão ou recibos. Depois da primeira etapa, teclado atravessa a Câmara pela manutenção e toque pelo intervalo; depois de5/5, usam as rotas opostas. Cada jornada percorre a Galeria de verdade, exige ALÍVIO, observa o resultado aberto/intacto, volta ao Bairro com o snapshot e os recibos idênticos e confirma que uma entrada posterior recomeça a Galeria. DOM/canvas/áudio e transporte de assets são fronteiras simuladas: esta prova offline não é inspeção visual de navegador, teste físico de celular nem medida de FPS.

As mecânicas, arte e os nove arquivos do protótipo de Câmara são dependências congeladas e não foram alterados por esta integração. O build completo, limite de45MB, revisão visual e publicação consolidada pertencem à etapa final de integração. Nenhum acesso ao servidor Oracle faz parte desta mudança.
