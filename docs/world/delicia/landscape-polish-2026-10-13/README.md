# Império da Delícia — apoios e muros, revisão 10

Revisão de 13/10/2026 a partir do modelo v9. [Comparação visual e vídeos](index.html).

## Correções

- Novas bases fechadas sob o jardim, campanário e três casas. O maior vazio medido no contorno recuado do jardim era de 3,1366 m. As bases se sobrepõem discretamente às peças antigas e entram no terreno.
- A auditoria do contorno das cinco bases utiliza 1.859 amostras, espaçadas em até 3,5 cm. A menor penetração medida é de 0,2138 m.
- Os antigos muros do pomar e da costa foram substituídos por quatro trechos de alvenaria contínua, capeamento chanfrado e pilares de acabamento.
- Recortes calculados sobre a pavimentação real, incluindo o contorno dos remates quadrados. Zero área de sobreposição com o piso; menor distância horizontal medida de 0,04021 m.
- 509 pedras compõem as fiadas dos apoios e muros, com juntas discretas e cortes nas extremidades.
- Dez conjuntos de folhagem da pérgola foram recolhidos sobre as vigas. A vegetação anterior permanece oculta e preservada no arquivo.
- As 14 chegadas e 16 rotas mantêm coordenadas, profundidades e durações. Nenhuma alteração na física, interface ou progressão do World.

## Fontes

- [Modelo Blender v10](../imperio-delicia-v10.blend)
- [Render final](../island-render-v10.png), [profundidade](../island-depth-v10.png), [navegação](../island-map-v10.json).
- `tools/delicia/finish_landscape_supports.py`: autoria a partir de v9; aceita `--draft`, `--no-render` e `--audit-only`.
- `tools/delicia/layout_landscape_walls.py`: recorta muros e verifica a folga em relação ao pavimento, com Shapely.
- Publicação dos assets correspondentes: `python tools/delicia/package_island.py --revision 10`.

## Verificação

365 testes existentes aprovados; `npm run build` concluído, incluindo validações de fases/assets/World e TypeScript.

O modelo salvo passou na verificação de 14 novas malhas fechadas e no ensaio de encaixe das cinco fundações. A auditoria do terreno encontrou zero interpenetrações com as faces superiores do piso existente, com folga mínima de 0,085 m.

No navegador: 14 chegadas, 12 viagens contínuas em desktop e viagem até o jardim em tela móvel; reversão; entrada e retorno da fase; 11 transições por toque; bloqueio de destino indisponível e movimento reduzido. Saves de teste ficam em contextos isolados.

O teste de profundidade amostra um envelope conservador de Feka pelas 16 rotas e complementa a revisão visual. As vistas laterais são renders técnicos do Blender; os comparativos do mapa e os vídeos usam o jogo.

Evidências: [verification.json](verification.json).
