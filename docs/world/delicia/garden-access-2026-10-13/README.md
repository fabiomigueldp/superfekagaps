# Império da Delícia — acessos do jardim, revisão 11

Revisão de 13/10/2026 a partir do modelo v10. [Comparativos e vídeos](index.html).

## O que mudou

- A chegada da fase 9 foi deslocada para o interior do jardim. O portão norte tem uma abertura real na balaustrada, alinhada ao corredor.
- Três escadas fechadas, com 27 degraus: descida norte de 10 degraus, saída leste de 9 e escada inferior de 8. Pisadas acima de 24 cm e espelhos abaixo de 19,3 cm, com patamares e guias baixas. As laterais receberam 167 pedras de revestimento ajustadas à inclinação.
- Patamar junto à porta do campanário e ligação do passeio da costa com o acesso inferior. O santuário do sino mantém a sua posição.
- Recuo de 60 cm na lateral leste da pérgola, mantendo encontros entre colunas, vigas, caibros e vegetação. Três árvores e um arbusto foram replantados para liberar os acessos.
- Novas rotas `garden-gate` e `clock-sanctuary`, exportadas das mesmas curvas usadas para construir as superfícies. As outras 14 rotas e 13 chegadas preservam coordenadas e profundidades.
- Piso refinado também no interior dos polígonos, com malhas fechadas e guias ajustadas. O ajuste do terreno considera as faces superiores dos caminhos e os degraus.

## Arquivos e reprodução

- [Modelo Blender v11](../imperio-delicia-v11.blend), preservando os objetos substituídos.
- [Render](../island-render-v11.png), [profundidade sem perdas](../island-depth-v11.png), [navegação](../island-map-v11.json).
- `tools/delicia/refine_garden_access.py`: executar no Blender a partir de `imperio-delicia-v10.blend`; opções `--draft`, `--no-render`, `--audit-only`.
- `tools/delicia/layout_garden_access.py`: união e triangulação do pavimento; Python com Shapely 2.1+.
- `python tools/delicia/package_island.py --revision 11`: publica imagem, profundidade e navegação correspondentes.

## Verificações

365 testes existentes aprovados; `npm run build` concluído, incluindo validações e TypeScript.

Verificação das malhas fechadas, da superfície sob o trajeto de Feka e de interseções entre terreno e pavimento. O envelope conservador do personagem é amostrado ao longo das 16 rotas e complementa a inspeção visual.

No navegador: 14 chegadas, 12 viagens contínuas, percurso em celular, 11 transições por toque, reversão, entrada e retorno de fase, bloqueios e movimento reduzido. Testes em contextos isolados, sem alterar o save do usuário.

As imagens de inspeção mantêm câmera e iluminação. As capturas e os vídeos do jogo usam o render final e o sistema de caminhada compartilhado do World.

[Resultados detalhados](verification.json). [Revisão anterior](../landscape-polish-2026-10-13/index.html).
