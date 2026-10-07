# Oficina: menu e HUD compactos

A interface usa desenho Canvas em pixels inteiros, na composição nativa de
320×180. Não usa a imagem de conceito como textura.

- Mantém a placa azul-petróleo, ferragens de latão, nome SUPER / FEKA / GAPS,
  postes de madeira, seleção em dourado claro com letras escuras e marcador
  diagonal da direção Oficina original.
- O HUD mantém uma única placa com fase, moeda, selo e espaço para o capacete.
  Ela mede 160×16 em vez de ocupar toda a largura. A área central/direita do
  cenário permanece livre. O chefe conserva sua própria linha contextual.
- O menu principal tem Jogar/Continuar, Opções e Galeria em coluna. Original
  continua disponível como ação secundária.
- Pausa prioriza Continuar, Opções e Voltar ao mapa. O nome completo da fase
  quebra em linhas quando necessário. Exportar/importar progresso permanece
  na tela Opções, com ativação nativa por Enter ou toque.
- Os mesmos controles HTML continuam cuidando de foco, Tab, teclado e controle.
  Abaixo de 480 CSS px de largura do Canvas, os menus principais se reorganizam
  com botões de pelo menos 44 CSS px; telas baixas permitem rolagem.
- Em telas estreitas com espaço livre acima do jogo, a informação legível e o
  botão Pausar ficam nesse espaço, substituindo o HUD desenhado para evitar
  duplicação. O botão nativo Pausar tem 44×44 CSS px. Sem esse espaço, preserva-se
  o HUD Canvas com o alvo nativo de pausa no canto.

## Verificação desta alteração

Testes focados cobrem manutenção de saves, importação atrasada, pausa, opções,
controle, teclado, foco nativo, ajuda, ciclo de vida de cenas, capacete e chefe.
O teste `world-workshop-ui.test.ts` também verifica limites de pixels, tamanho
da placa, nomes completos e ações conservadas.

O script `scripts/prove_workshop_ui.ts` produz quadros reais de 320×180 dos
pintores de produção e uma ampliação inteira de 2×. Executar:

```sh
node --import tsx scripts/prove_workshop_ui.ts OUTPUT INSTALLED_CANVAS_MODULE
```

O script usa um módulo Canvas já instalado e nenhuma dependência nova do jogo.
A execução é isolada/efêmera: não acessa saves reais; o contador 024 é uma
fixture visual. O quadro de Opções efêmero omite o botão de ajuda DOM, cuja
presença e navegação são cobertas pelos testes da tela normal.

Isso é prova de rasterização nativa, não de navegador ou dispositivo. Antes de
publicar, verificar uma prévia no navegador em 360×640, 640×360 e desktop:
44 px sem alvos sobrepostos, nenhum corte horizontal, foco visível, rolagem da
tela Opções, Pausar/Continuar, importação cancelada, ajuda e retorno ao mapa.
