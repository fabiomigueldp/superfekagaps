# Verificação da entrega — 4 de outubro de 2026

A expansão está implementada no projeto local. São doze fases principais, dois
percursos opcionais com terreno próprio, vinte memórias e dois chefes com três
fases. O mapa tem modelo Blender e uma posição de escala fixa no atlas World.

## Evidências

- `npm run check`: 1.430 testes TypeScript e três testes JavaScript aprovados,
  validações da campanha e sprites, dois typechecks e build Vite concluídos.
- `tests/delicia-campaign.test.ts`: treze verificações específicas da expansão,
  incluindo travessia, importação, recordes, combate físico e integridade de mídia.
- `output/delicia/browser-report.json`: controles nativos, movimento de teclado,
  pausa, queda em gap, retomada, vinte áudios decodificados, mute, panorama World,
  entrada por query e toque móvel; nenhum erro registrado.
- `output/delicia/production-report.json`: entradas e controles do build real,
  assets de Guina, barra de vida e carregamento dos chunks; o global de debug da
  expansão não é publicado. Nenhum erro ou recurso ausente foi registrado.
- `runtime-manifest.json`: sete imagens e vinte arquivos de áudio, com fontes e
  hashes. Os treze mestres de música/efeitos também conferem seus hashes originais.
- Busca da credencial fornecida nos arquivos autorados e no build: zero ocorrências.

As imagens de combatentes e alguns casos de contato usam posições arranjadas para
inspeção e são identificados nos relatórios do navegador. A auditoria automática
de terreno separa obstáculos de inimigos. Os dois chefes também são vencidos em
teste pela simulação real, desde o spawn, sem alterar vida, invulnerabilidade ou
estado de vitória. Isso demonstra viabilidade física; não equivale a uma
certificação por playtest humano prolongado.

## Empacotamento

O pacote medido tem **201 arquivos e 48.835.589 bytes**, com **1.164.411 bytes** de
margem no limite atualizado de **50.000.000 bytes**. `build-size.json` registra a
medição por extensão. O orçamento anterior de 45 MB foi ajustado para incluir a
expansão solicitada. A lista anterior de 21 exclusões permanece intacta.

As sete imagens e vinte áudios derivados da expansão somam **5.184.385 bytes**.
PNG, MP3, Blender e GLB mestres ficam em `docs/world/delicia`, fora do deploy;
somente WebP, Opus e metadados do mapa entram no diretório público. As fontes
anteriores do jogo não foram removidas nem recomprimidas. A expansão carrega por
entrada própria; seu diorama só é solicitado no panorama do mapa principal.

Foram conferidos teclado e toque em Chromium, além da decodificação dos vinte
áudios. Safari/iOS, controle físico, sessões extensas de playtest e comparação
auditiva entre original MP3 e Opus não fizeram parte desta verificação. Não houve
publicação online ou alteração de um serviço de produção.

## Arquivos para continuar a produção

- `README.md`: direção, história, controles e reprodução.
- `image-generation.json`: os seis prompts, modo e referência usada.
- `imperio-delicia.blend` e `imperio-delicia.glb`: ilha 3D editável/exportada.
- `audio-manifest.json` e `voice-manifest.json`: geração original e interpretação.
- `tools/delicia/`: construção do diorama, geração de áudio e empacotamento.
- `src/adventure/delicia/`: conteúdo, física, chefes, arte, áudio, progresso e UI.

O título usa uma aventura cômica ficcional. A documentação distingue as referências
biográficas da história inventada e identifica a voz como uma interpretação de
biblioteca. A chave de API permanece somente no arquivo privado fornecido.
