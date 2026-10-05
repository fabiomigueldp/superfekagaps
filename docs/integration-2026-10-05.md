# Integração local e remota — 5 de outubro de 2026

A expansão Império da Delícia foi incorporada sobre `6864775`, a `main` remota
verificada nesta revisão. O checkout local anterior estava em `c817815`, 21
commits atrás dessa base. A branch de integração é
`codex/integrate-delicia-remote-20261005`.

## Desenvolvimentos recebidos do remoto

- Guaíra: continuidade de história, escolhas no Pátio, trajetos opcionais,
  retorno da água conquistada, controles de toque e segurança dos comandos
  após pausa, perda de foco e troca de cena.
- World: navegação compacta por teclado, ajuda de controles, redução de
  movimento, câmera, salto, proteção do jogador e apresentação do respawn.
- Viagens e combate: margens dos voos, antecipação dos chefes, leitura dos
  avisos de canhão e resposta a golpes bloqueados.
- Arte: vila e arrozais de Guaíra, montagem das roldanas da Serra e contato
  dos guarda-corpos da Fábrica com as plataformas.

As novas branches de revisão de 4 e 5 de outubro já estavam contidas na
`main`. As branches históricas com commits reaplicados ou refinados não foram
mescladas novamente.

## Trabalho local incorporado

Entradas `delicia.html` e `?delicia=true`, acesso no mapa World e ilha no
panorama, 12 fases principais, dois santuários opcionais, 48 setores de
exploração, oito famílias de inimigos, Jajá e Guina, memórias, medalhas,
progresso independente, interface e controles. Os assets WebP/Opus, os
originais, os modelos Blender/GLB e os utilitários de produção estão
preservados. A documentação detalhada está em
[Império da Delícia](world/delicia/README.md).

O único conflito foi em `WorldMapView.ts`. A resolução preserva o novo acesso
a Guaíra, seus limites de terreno e as camadas de água conquistada, somando
os links, o enquadramento e a imagem da Delícia. Os IDs e os saves da campanha
World continuam compatíveis.

Os caminhos de imagem, metadados e áudio da expansão agora respeitam
`BASE_URL`, incluindo bases relativas e publicações dentro de
`/world/releases/…/`. O teste de produção também verifica a entrada por query
e o retorno ao World dentro da mesma publicação.

Capturas locais em `output/` e backups automáticos `.blend1` ficam fora dos
novos commits. As fontes editáveis e os assets necessários permanecem
versionados. Uma cópia de segurança Git completa do estado local anterior,
incluindo arquivos sem commit e capturas, foi preservada neste checkout.

## Validação

- `npm run check`: **1.821 testes TypeScript e três testes de servidor**,
  todos aprovados; validadores, ambos os typechecks e build aprovados.
- `npm run size:build`: **210 arquivos, 50.982.804 bytes**, dentro do limite
  de 53.000.000 bytes, com 2.017.196 bytes de margem.
- `scripts/verify_delicia.cjs`: movimento e salto reais, pausa, checkpoint,
  queda em gap, mute, decodificação dos 20 áudios, entrada por query, panorama
  do World e controles de toque.
- `scripts/verify_delicia_ui.cjs`: teclado, menus, importação inválida,
  controle virtual e toque em 320 px, 390 px e paisagem.
- `scripts/verify_delicia_production.cjs`: build servido em
  `/world/releases/integration-20261005/`, seis fases representativas,
  os dois chefes, pausa, assets, query e retorno ao World.
- Revisão com `agent-browser`: menu World, panorama e entrada da expansão
  carregam com elementos acessíveis e sem erros de página.

Relatórios e capturas selecionados estão em
[world/delicia/integration-2026-10-05](world/delicia/integration-2026-10-05/).
Os scripts usam perfis de navegador isolados; estados preparados para a
cobertura de apresentação não equivalem a uma campanha concluída pelo jogador.
A revisão não inclui playtest humano prolongado ou controle físico.

Esta integração prepara o código e o PR; a publicação online é uma operação
separada.
