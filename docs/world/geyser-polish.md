# Gêiseres de suco: leitura de pressão e líquido

## Escopo visual

`WorldGeyserArt`, `WorldGeyserAssets` e `WorldGeyserState` apresentam os jatos fora do mundo 6. O dispatcher integrado de `WorldMachineArt` usa `WorldBurnerArt` no mundo 6 e reexporta o canhão de `WorldCannonArt`. A reabertura manual com aviso completo está documentada separadamente em `geyser-valve-fairness.md`; fases e regras de dano permanecem iguais.

- Aço azul, latão e concentrado roxo da linguagem industrial existente
- Sump rebitado, corpo com anéis, visor lateral que enche, mostrador de pressão e pequeno pistão
- Válvula fechada com saída tampada e raios cruzados, além da mudança de cor
- Antecipação dentro da boca, bolhas e três marcas de pressão antes da erupção
- Núcleo sinuoso e coroa de líquido, com margem visual conservadora para a colisão
- Gotas claras separadas, trajetória balística contínua, impacto no piso e drenagem
- Variante gelada com gelo localizado no metal, mantendo o suco roxo
- Sprites estáticos no `SpriteAtlas`; movimento deriva do relógio da simulação, sem aleatoriedade nem alteração de estado no desenho

## Contrato de desafio preservado

O período original é 4200 ms. Os offsets das fases e todos os encontros existentes permanecem idênticos. No período-base:

| Janela | Leitura |
| --- | --- |
| 0–820 ms | repouso |
| 820–1000 ms | antecipação cosmética na boca |
| 1000–1360 ms | bolhas, início do aviso existente |
| 1360–1800 ms | pressão, mostrador alto e três marcas |
| 1800–1920 ms | erupção com perigo acompanhando a altura real |
| 1920–2330 ms | sustentação |
| 2330–2500 ms | retração |
| 2500–2850 ms | gotas, impactos e drenagem sem dano |

Há 800 ms de aviso e no máximo 700 ms de perigo por período. Fumaça e gotas não colidem. Todo o retângulo perigoso recebe líquido opaco; a franja e a coroa decorativas podem ultrapassá-lo ligeiramente, de modo favorável ao jogador. O aspecto de fluido deixa de afinar para dentro da área perigosa, um problema da versão anterior junto à saída.

## Verificação

`tests/world-geysers.test.ts` cobre fases, períodos e offsets negativos, pausa, válvula fechada, geometria visual pixel a pixel, coordenadas inteiras, pureza do desenho, trajetória/impacto de gotas, paleta e todos os gêiseres dos mundos 3 e 5. Os testes de máquinas existentes continuam cobrindo áudio, retração, válvulas, canhões e esteiras.

O comparativo de produção é um **harness isolado do renderer**, com antes/depois no mesmo timestamp, tamanho e cenário esquemático. Ele não deve ser apresentado como gravação de uma partida. Uma eventual melhoria de repressurização de válvula deve ser revisada separadamente, pois afeta o relógio da máquina.
