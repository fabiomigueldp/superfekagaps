# Verificação do mapa conectado

Revisão de 30 de setembro de 2026, na prévia Vercel da branch `feat/connected-coast-port`.

## Verificado

- Commit `c11b96d6`: 283 testes TypeScript e 3 testes do servidor aprovados. Validadores de fases, sprites e campanha, ambos os projetos TypeScript e build de produção aprovados.
- Chrome: entrada real em 1-1 pelo teclado, pausa e retorno ao mapa preservando a fase alcançada. Enter numa fase bloqueada permanece no mapa.
- As seis regiões continuam acessíveis pelo arquipélago. A prévia bloqueada de Porto não cria chegada nem libera entrada; a região 3 mantém o fallback existente. Voltar à Costa restaura o enquadramento e a entrada disponível.
- O enquadramento de Porto bloqueado mostra os cinco pontos completos, sem forçar Feka, ainda na Costa, para dentro da câmera. As posições geográficas não mudam.
- O navegador carregou `index-Czaxv_iB.js` e `index-B7zdXZZd.css`, correspondentes ao build conferido. Os deployments de prévia e produção desse commit terminaram com sucesso.
- Capturas restritas à aba/janela do jogo. A verificação a 200% de zoom produziu um viewport real de 590 × 378 pixels CSS; não equivale a um dispositivo com toque.
- Em 590 × 378, a inspeção dos retângulos DOM confirmou alvos de fase de 56 × 58 e cais de 104 × 56 pixels, separados por pelo menos 8 pixels. A placa do cais e as cinco fases de Porto permanecem inteiras e selecionáveis.
- Duplo clique numa fase disponível apenas a seleciona; a entrada permanece explícita. O menu do arquipélago conserva rolagem vertical quando a janela é baixa.
- Um save sintético, limitado à origem da prévia, liberou a viagem Costa ↔ Porto. A importação mostrou sucesso e removeu o input temporário depois de ler o arquivo.
- Viagens completas em ambos os sentidos, Feka a bordo, entrada real em 2-1 e retorno ao mapa na mesma chegada foram verificados no navegador.
- Durante a navegação, Enter permaneceu no mapa. Mudar para Costa e novamente para Porto durante o mesmo trecho conservou a viagem; Pular confirmou a chegada sem iniciar a fase.
- Recarregar enquanto o barco navegava restaurou a última chegada confirmada em 2-1. O viewport de 590 × 378 também completou a navegação e Pular.
- No enquadramento próximo da travessia, as placas interativas dos cais ficam ocultas para deixar Feka e o barco inteiros. Setas, Arquipélago e Pular continuam disponíveis; os cais reaparecem depois da chegada. O quadro de navegação estreita foi revisto após essa correção.
- Em `https://superfekagaps.vercel.app/`, o smoke da versão publicada percorreu introdução, mapa, entrada em 1-1, pausa e retorno ao mapa, com seleção e bloqueios preservados. Nenhum save sintético foi importado na origem de produção.

## Pontos encontrados na revisão

As primeiras passagens corrigiram os destinos invertidos nas placas dos cais, uma sombra antiga com limite retangular exposto no atlas, o excesso de largura do painel de fase e o enquadramento da região bloqueada. A revisão em 590 × 378 encontrou sobreposição entre o cais de Porto e a fase 2-1; a disposição agora separa os alvos completos, conserva o lado durante a câmera e liga pequenos deslocamentos ao ponto real sem desenhar sobre Feka ou o barco.

## Limites desta passagem

A cobertura automatizada também verifica falha de assets, carregamentos tardios, movimento reduzido, cancelamento da importação e leitura antiga invalidada quando outra importação começa. A falha de assets e a preferência real de movimento reduzido não foram induzidas no navegador desta passagem.

Ainda não foram medidos FPS ou desempenho em aparelho móvel. Preferência real de movimento reduzido e toque físico não foram exercitados no navegador. Os testes de layout e projeção incluem 320 × 568, 400 × 606 e paisagem baixa; isso não substitui a inspeção visual nesses aparelhos.

## Publicação

A publicação contém apenas os assets de runtime e fontes versionados. Nenhum arquivo de save de teste faz parte do produto. Esta alteração não modifica a implantação no Oracle.
