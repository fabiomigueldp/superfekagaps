# Império da Delícia — alvenaria e mirante, v9

Revisão de 13/10/2026 a partir do modelo v8. [Abrir a comparação](index.html).

## Alterações

- 576 pedras de borda moldadas ao contorno real do pavimento, em 21 trechos. Perfil chanfrado, cortes nas curvas e juntas de 6 mm.
- As bordas param antes dos acessos às escadas e às pontes. O traçado vem da união das faces superiores do piso, com recortes para essas entradas.
- Mirante da Maré de Laranja unido ao caminho por operação booleana exata: fundação fechada, guarda-corpo baixo, banco de pedra e seis lajes largas. A entrada norte está livre.
- Terreno ajustado sob o novo calçamento. A auditoria do arquivo salvo encontra zero interpenetrações entre os triângulos de terreno e as faces superiores da pavimentação; folga mínima de 0,085 m.
- As 14 chegadas e as 16 rotas conservam coordenadas, profundidades e durações. Os elementos substituídos ficam ocultos e preservados no arquivo Blender.

## Fontes e reprodução

- [Modelo editável](../imperio-delicia-v9.blend)
- [Render](../island-render-v9.png), [profundidade](../island-depth-v9.png) e [navegação](../island-map-v9.json).
- Autoria: `tools/delicia/refine_island_masonry.py`, a partir de `imperio-delicia-v8.blend`. Suporta `--draft` e `--no-render`.
- Contorno das bordas: `tools/delicia/layout_masonry_edges.py` (Python com Shapely).
- Geometria: abrir o v9 em Blender background e executar `refine_island_masonry.py -- --audit-only`.
- Publicação dos três assets correspondentes: `python tools/delicia/package_island.py --revision 9`.

## Verificação

365 testes existentes aprovados. `npm run build` concluído, incluindo validação de fases e assets, validação do World e TypeScript.

No navegador: 14 chegadas, 12 viagens contínuas em desktop, caminhada até o mirante em tela móvel, reversão, entrada e retorno da fase, 11 transições por toque, bloqueio de destino indisponível e movimento reduzido. Os vídeos registram a caminhada real, sem saltar até os destinos.

A auditoria de profundidade amostra um envelope conservador de Feka ao longo das 16 rotas; é complementar à inspeção visual e não substitui a máscara real do sprite. Evidências numéricas em [verification.json](verification.json).

As comparações usam a mesma câmera, fase e interface. Os testes de progressão utilizam contextos de navegador isolados e não alteram o save do jogador.
