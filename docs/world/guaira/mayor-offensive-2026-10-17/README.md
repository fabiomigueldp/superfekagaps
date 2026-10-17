# Prefeito da Vazão — perseguição e pressão

Revisão de 17/10/2026. [Jogar](../../../../guaira-prefeito.html) · [Ver as cinco partidas completas](index.html).

## Problemas encontrados

- Um registro usado depois do primeiro disparo cancelava tanto a salva como todos os saltos seguintes. A estratégia de interrupção permitia repetir a abertura com pouca necessidade de deslocamento.
- O chefe sempre voltava à mesma posição, sem ofensiva de deslocamento no piso central. A passarela tornava parte dos perigos irrelevante.
- A mira escolhia a altura pela coordenada horizontal, mesmo quando Feka estava sob uma plataforma. Isso podia dirigir o impacto para cima do jogador.

## Mudanças

O primeiro lacre ensina o alvo fixo, a sentada e a subida. No segundo, depois da salva ou de um corte de pressão, o chefe salta da passarela para o lado oposto de Feka e prepara uma investida. O terceiro acrescenta uma segunda passagem em sentido contrário, com nova preparação completa, antes das duas carimbadas.

Cada direção é comprometida antes do movimento. Há 42 atualizações de preparação na segunda fase e 36 na terceira, além da descida de 32 atualizações. A velocidade aumenta gradualmente até 5 ou 5,8 pixels por atualização. A crista de água usa os mesmos contornos em degraus para desenho e colisão.

Se Feka está sobre a passarela no início da perseguição, a investida vem acompanhada de um disparo alto com aviso completo. Mudar de posição depois não altera essa decisão. O piso e a passarela continuam sendo estratégias viáveis; ignorar os respectivos avisos causa dano real.

A interrupção agora elimina o restante da salva, o disparo alto adicional, as ondas e a descarga da emenda daquele ciclo. Ela preserva a perseguição física. Depois do último impacto, uma nova sentada abre o acesso. Os três lacres, a física do jogador, os controles, o elevador nativo e a progressão da campanha permanecem integrados ao encontro.

As animações ganharam preparação com transferência de peso, oito poses de passada, frenagem com apoio do calcanhar, faixa acompanhando o giro e poeira/respingos no contato com o chão. Os efeitos decorativos são de tons claros e terrosos; o ciano sólido identifica água perigosa. O tempo vem da simulação, portanto renderizar ou pausar não avança efeitos. Redução de movimento segura as poses cosméticas sem mudar os ataques.

## Verificação e limites

As cinco gravações usam apenas controles nativos, sem escrever vida, posição, relógio, lacres ou mecanismos. Incluem passagem pelo chão, passarela, interrupções pelos dois registros, espera na emenda e oportunidade perdida seguida de acionamento tardio. As durações de 32–52 segundos são de percursos ensaiados, não estimativas de uma primeira partida.

Os testes verificam compromisso de direção, preparação antes de cada reversão, velocidade limitada, decisão de pressão na passarela, correspondência entre água desenhada e colisão, dano ao ignorar a esquiva, pausa e reinício. A câmera acompanha os saltos altos; o chão pode sair do enquadramento durante o ápice, quando Feka está acima da investida. A preparação fica visível antes do salto, e o HUD mantém o aviso.

[Resultados consolidados](verification.json) · [Capturas nativas](native-verification.json) · [Navegador](browser-verification.json) · [Campanha normal](campaign-verification.json).

Para reproduzir, execute os testes `guaira-mayor*.test.ts`, `npm run build` e `scripts/prove_guaira_mayor_offensive.ts` com um diretório de saída e o módulo de canvas nativo. `scripts/record_guaira_mayor_offensive.ts` recompõe os cinco percursos por entradas normais; `GUAIRA_MAYOR_ROUTE` escolhe `upper`, `ground`, `interrupt`, `wait` ou `retry`.

Toque e gamepad são simulados pelas APIs de entrada. A revisão visual e os percursos automatizados não substituem uma rodada com pessoas que ainda não conhecem os padrões.
