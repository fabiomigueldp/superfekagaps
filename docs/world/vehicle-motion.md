# Movimento de barcos e aviões

Os efeitos usam o relógio do mapa e os sprites existentes. Não há dependência de física, novo loop de animação ou alteração do save.

## Barcos

`WorldFerryModel.ts` preserva os pontos e tempos das travessias. O leme ganha velocidade angular gradualmente, com amortecimento crítico e limite de giro. A reversão integra uma curva suave de frenagem e retomada, mantendo a posição e a velocidade inicial ao mudar o destino.

`WorldVesselMotion.ts` aplica respostas amortecidas ao deslocamento vertical, à inclinação lateral e à inclinação longitudinal. Duas ondas em coordenadas do mapa determinam a água sob a proa, a popa e os bordos. Curvas, aceleração e frenagem também carregam o casco. Nos cais, ondas com 55% da intensidade mantêm uma flutuação discreta. A chegada preserva os deslocamentos e velocidades das molas: a carga residual se dissipa gradualmente, sem nivelar o barco de repente.

Flutuação e inclinação são transformações visuais do grupo inteiro: casco, passageiro e camada frontal. Os pontos de navegação e embarque permanecem fixos. A câmera reserva uma folga constante para todo o balanço, sem acompanhar cada onda; a proteção contra sobreposição das placas considera os limites visuais do casco a cada instante. O balanço continua durante o embarque e quando outra embarcação está navegando, sem produzir espuma de propulsão no barco parado.

A espuma nasce a cada 60 ms, fica em coordenadas do mundo por até 2,2 segundos e tem limite de 38 amostras por barco. Continua se espalhando e desaparecendo após curvas e paradas. Pausas longas, saltos de tempo e reposicionamentos descartam históricos incompatíveis. A espuma próxima da popa e a onda de proa seguem a propulsão; não são emitidas durante marcha a ré. As boias acompanham o mesmo campo de ondas.

O custo é limitado a duas molas de atitude, uma de flutuação e uma de direção por barco, mais até 37 segmentos de espuma e 19 manchas de turbulência. Nenhuma partícula aloca canvas, textura ou timer.

## Aviões

As corridas de decolagem e pouso integram rampas de velocidade suaves, com os mesmos terminais, tempos e velocidades de contato. A inclinação e os flapes atravessam a decolagem e o pouso sem saltos. A hélice integra a rotação do motor, aumenta o desfoque com a potência e para no ângulo final. O trem de pouso comprime e dissipa a energia do contato. Veja também `journey-aircraft.md`.

## Verificação

`world-vessel-motion.test.ts` cobre dissipação de energia, taxas de 30/60/120 Hz, flutuação em ambos os cais das duas linhas, continuidade ao atracar, acomodação da carga residual, limites de resposta, histórico de espuma, pausa, repetição de amostras e movimento reduzido. `world-atlas-art.test.ts` verifica a camada do passageiro, os limites do casco deslocado e inclinado e a pintura limitada da espuma. `world-aircraft-travel.test.ts` verifica continuidade de atitude, flapes e rotação, além da aceleração e do pouso.

Movimento reduzido remove balanço, giro decorativo, espuma, oscilação das boias, rotação da hélice e atuação dos flapes. As posições de navegação continuam sendo as originais.
