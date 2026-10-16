# Revisão de interface, 15 de outubro de 2026

## Diagnóstico

As capturas mostram um problema de responsabilidade e hierarquia, não apenas de tamanho de fonte. O site, o host de Guaíra e o runtime nativo ofereciam controles sobre a mesma partida. O jogador precisava interpretar três sistemas ao mesmo tempo.

A barra externa de Guaíra era também uma dependência do cálculo do canvas. Ao pausar ou concluir, entravam quatro botões, instruções de teclado e texto sobre salvamento. A altura crescia e o jogo caía para outro múltiplo de escala, alterando o enquadramento justamente na transição. Esconder parte dos botões durante a partida não resolvia a arquitetura.

O padrão correto já existia no World e na Delícia: pausa dentro da superfície do jogo, com Continuar, Opções e Voltar ao mapa. A integração de Guaíra deve seguir esse padrão.

## Inventário e decisão

| Superfície | Controles e informações encontrados | Decisão |
| --- | --- | --- |
| Player do site, todas as edições | Voltar, título em duas linhas, idioma, Abrir direto, Tela cheia | Barra estável de 48 px. Apenas voltar à coleção e tela cheia. Título discreto. Idioma permanece no site; acesso direto fica na recuperação de carregamento e no fallback sem JavaScript. |
| World, título | Jogar/Continuar, Opções, Galeria | Acesso principal evidente. As opções já pertencem ao jogo. |
| World, partida | HUD, pausa, movimento, salto, corrida e golpe | Manter informação de jogo. Não repetir ações em outra barra. |
| World, pausa | Continuar, Opções, Voltar ao mapa | Padrão de navegação para os capítulos integrados. |
| World, opções | Música, efeitos, vozes, exportar, importar, tremor, controles e voltar | São preferências ou manutenção de progresso. Permanecem fora da partida, sob demanda. Não levar exportação/importação ao HUD. |
| World, mapa | Mundo, lista de ilhas no panorama, menu, placas, transportes, jogar e pular viagem | Diferentes escalas de navegação. Lista é alternativa acessível ao mapa espacial; transportes são ações do mundo. Manter disponibilidade contextual. |
| Guaíra, partida | Pausa externa, etapa/objetivo externo, HUD com objetivo e outro símbolo de pausa | Remover barra. Alvo acessível no símbolo de pausa nativo. Orientação contextual continua no runtime e nos anúncios acessíveis. |
| Guaíra, pausa | Continuar, controles, recomeçar, mapa, som e referência de teclado | Três ações no primeiro nível. Som, Controles e Recomeçar dentro de Opções. Remover referência de teclado duplicada. |
| Guaíra, conclusão | Continuar junto com os quatro botões de pausa e textos de navegação/salvamento | Continuar como única ação no percurso principal. Manter o cenário no mesmo tamanho. |
| Galeria/Câmara de Alívio integradas | Alívio, Outra rota, recomeçar e Bairro | Preservar as continuações opcionais. Retorno visual padronizado como Voltar ao mapa; o nome acessível identifica o Bairro. Reinício pertence a Opções. |
| Guaíra, ajuda | Instruções de teclado/toque, explicações repetidas de navegação, fechar com rótulo longo | Ajuda sob demanda. Fechar passa a Voltar. Explicar só as consequências de reiniciar e sair. |
| Guaíra, moedas | Ícone, número e “NO TRECHO” | Ícone e número. A contagem continua sendo da tentativa; nenhuma regra de coleta foi alterada. |
| Delícia integrada | Pausa, opções, memórias, assistência, exportar/importar e resultado | Já usa `WORLD_PAUSE_ACTIONS` e o mapa compartilhado. Manter seus recursos no menu nativo, sem barra adicional do site ou do capítulo. |
| Salão da fábrica integrado | Continuar, pose/pular cena conforme o momento, reiniciar, controles e voltar à fase | Controles já contidos no salão; nenhum espaço acima do canvas é reservado. As ações da apresentação e do combate são contextuais. |
| Carregamento/erro | Textos explicativos e recuperação | Preservar tentar novamente e saída. Erros são exceções reais, não microcopy permanente. |
| Experimentos isolados e editores | Barras próprias de protótipos, atalhos entre laboratórios e controles técnicos | São entradas separadas da campanha. Não importar esse padrão para World. Esta revisão altera a experiência integrada; não remove ferramentas de autoria nem converte esses protótipos em campanha. |

## Alterações

- A navegação do site foi reduzida igualmente em Classic, Remastered, World e players experimentais.
- Guaíra usa um único menu dentro do jogo para seis trechos e dois percursos opcionais.
- O menu de pausa não participa do cálculo do tamanho do canvas.
- O runtime não pinta um segundo cartão de pausa atrás do menu integrado.
- Botões de Guaíra compartilham largura, fonte e acabamento. O destaque fica em Continuar.
- Texto de teclado e sucesso de salvamento deixaram de ocupar a interface. Falhas reais continuam visíveis e anunciadas.
- As ações preservam os limites de input existentes: uma tecla segurada ou gesto iniciado antes da ajuda não pode disparar reinício ao fechar.

## Verificação

Verificações automatizadas exercitam navegação, pausa, opções, ajuda, som, retomada, resultado e retorno ao mapa. O resultado é injetado no teste de interface para validar a transição; não representa uma vitória de gameplay. Capturas e relatório ficam em `output/ui-*`.

Tamanhos conferidos: 1440×900, 320×700, 812×375 e 640×360, incluindo toque e movimento reduzido. O canvas mantém as mesmas dimensões ao pausar, abrir ajuda, retomar e concluir. Testes de propriedade, progresso, descarte de callbacks e áudio continuam separados das capturas visuais.

Os protótipos isolados conservam seus próprios controles de laboratório. Classic e Remastered conservam seus runtimes publicados e suas origens de armazenamento; a redução da barra do site também os atende. Não houve alteração de física, desenho dos mapas, critérios de vitória ou formato dos saves.

## Publicação

Publicado no Oracle em 15 de outubro de 2026. O player foi conferido no endereço público em português e inglês, nas três edições, com larguras de 1440, 390 e 320 px. Voltar e tela cheia permanecem acessíveis; a barra tem 48 px sem quebra de linha. A campanha servida pelo iframe foi aberta desde o título e a introdução, e o cenário de Guaíra manteve 1280×720 tanto na partida quanto na pausa.

O pacote `bca81df13598e481b4a32afbd5570f8d4628ac63-fa6487ebc08c` foi verificado por uma URL de preview antes da ativação em World e Guaíra. O comando `npm run check` passou: 3.118 testes aprovados, um ignorado, validações, TypeScript e build. A verificação de interface também passou nos quatro tamanhos acima pela URL do servidor, incluindo teclado e hit test dos controles de toque.

O catálogo mantém rollback para a versão anterior. As alterações do site foram aplicadas por patch restrito aos arquivos do player, com cópia anterior em `/home/ubuntu/torbware-ui-backups/20261015-cleanplay/` e imagens Docker anteriores preservadas. Capturas públicas e resultados: `output/ui-production-playing.png`, `output/ui-production-paused.png` e `output/ui-production-verification.json`.
