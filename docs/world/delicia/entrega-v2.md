# Império da Delícia — segunda produção

5 de outubro de 2026. Revisão jogável da expansão existente, integrada ao projeto
local e ao panorama do Super Feka Gaps World. Entrada: `/delicia.html` ou
`/?delicia=true`. O servidor local de revisão usa `http://127.0.0.1:3030/delicia.html`.

## O que mudou

Os dez percursos principais de exploração e os dois santuários foram redesenhados
em quatro setores próprios cada: **48 lugares nomeados**, com encontros,
marcos arquitetônicos, rotas altas, pontos de descanso, memórias e três checkpoints
por percurso. Os dois confrontos completam as **14 fases** da campanha. As saídas
continuam exigindo fontes abertas ou a derrota do chefe; selos e medalhas são opcionais.

| Percurso | Situação própria |
| --- | --- |
| Cais | Mercado, introdução ao movimento e pontes de maré |
| Pomares | Molas, rotas na copa, abelhas e vento ascendente |
| Aqueduto | Comportas em ordem que materializam as pontes superiores |
| Cascatas | Balsas, elevadores que carregam Feka e jatos de impulso |
| Arquivo | Emboscadas de barris e tábuas que racham, caem e se recompõem |
| Jajá | Caneca, ondas, investida, ressaca ritmada e três gêiseres |
| Maré | Balsas, correntes e travessias com impulso |
| Engrenagens | Esteiras opostas e prensas desligadas pelas fontes |
| Jardim | Flores lançadoras, estufa, vento e caminhos suspensos |
| Caldeira | Sequências de prensas e descargas sob pressão |
| Escadaria | Combinação final das mecânicas de travessia |
| Guina | Gaps reais, corações rebatíveis, investidas, prensas e sobrecarga |
| Raízes | Molas e vento até o santuário escondido |
| Sino | Elevadores e prensas em ritmos diferentes |

As oito famílias de inimigos têm silhuetas próprias. A Flor de Casca abre antes de
disparar três sementes em arco; o rolete prepara sua investida; o barril desperta
com a aproximação; sentinelas exigem atordoamento ou sentada.

## Combate e movimento

Cada chefe tem **oito poses novas**, com antecipação, ataque, corrida, exaustão,
troca de fase e derrota. O renderer combina essas poses com transições de opacidade,
inclinação, respiração, squash/stretch, movimento da investida, flashes de impacto
e partículas. São animações em Canvas com sprites, não rigs humanoides 3D.

Jajá alterna ondas em intervalos de aproximadamente 0,58 s na ressaca, além dos
gêiseres e da caneca. Guina tem indicador de pressão e duas válvulas. Todas as
colunas de uma prensa são sinalizadas. A troca de fase limpa projéteis, buracos e
perigos antigos, anuncia o novo capítulo e reserva tempo para reposicionamento.
O golpe agachado usa sua própria colisão inferior: saltar sobre ele funciona.

Impactos e rebatidas têm pausas curtas de 25–65 ms. Os comandos de teclado
pressionados durante essas pausas ficam armazenados até o próximo passo. A física
permanece a 120 Hz, com coyote time, salto variável, buffer e impulso. A câmera
da arena acompanha o ponto entre Feka e o chefe; a de exploração mostra mais céu
e menos subsolo. O modo de movimento reduzido mantém as pistas necessárias para jogar.

Medalhas registram percurso sem dano, três selos e tempo-alvo; nos confrontos,
três rebatidas rendem uma medalha. Assistência e retomada de checkpoint não
substituem recordes nem concedem medalhas de percurso completo. Saves v1 migram
com uma coleção de medalhas vazia e preservam fases, memórias e fontes.

Além de teclado e oito botões de toque, há suporte a controles com mapeamento
Standard Gamepad: direcional/analógico, A pular, B impulso, X sementes, Y rebater,
LB sentada, RB válvula e Menu pausa. O código foi conferido; um controle físico
não foi usado na validação desta entrega.

## Arte e ilha

Seis novas gerações pelo **imagegen integrado** foram salvas e incorporadas:

- `world-concept-v2.png`: nova vista de apresentação da ilha.
- `enemies-v2.png`: oito inimigos em atlas transparente.
- `jaja-motion-v2.png` e `guina-motion-v2.png`: oito poses de cada chefe.
- `landmarks-v2.png`: nove marcos arquitetônicos.
- `terrain-v2.png`: materiais de pomar, arenito, madeira e refinaria.

Prompts completos: `image-generation-v2.json`, `boss-generation-v2.json` e
`environment-generation-v2.json`. Os personagens anteriores serviram de referência
de identidade. As imagens de runtime são WebP; a transparência dos sprites foi
preservada. Todos os mestres continuam no repositório.

O Blender recebeu mercado com toldos e frutas, telhas individuais, moinho,
santuário, anfiteatro da grande caneca, arquivo, balcões de manutenção, pistões,
engrenagem, medidores, jardim, campanário, barcos e um cânion aberto na geometria
que expõe as cascatas. A pegada no atlas é fixa em **2,6 vezes a largura e a altura
nominais das ilhas antigas** — 6,76 vezes a área do canvas, não uma medição da
superfície habitável. O enquadramento e os marcadores vêm da mesma câmera Blender.

Fontes editáveis: `imperio-delicia-v2.blend`, `imperio-delicia-v2.glb` e
`island-render-v2.png`. A primeira versão foi preservada. O mapa no navegador usa
o render desse modelo; a plataforma jogável continua em 2D, conforme a arquitetura
existente do jogo.

## História, referências e áudio

A narrativa conserva o conflito entre a partilha e o medo da escassez: Guina
transforma uma prensa de emergência em um sistema de retenção; Jajá mantém uma
promessa baseada em um medidor adulterado. Vinte memórias e os ecos dos 48 setores
levam essa história para a exploração. A derrota de Guina termina em restituição
da safra e reconstrução das fontes.

Foi consultada novamente a [entrevista do UOL com Jailson Mendes, de 2016](https://entretenimento.uol.com.br/noticias/redacao/2016/10/26/ai-que-delicia-como-jailson-mendes-foi-de-ator-porno-a-vida-de-youtuber.htm)
para o contexto do bordão, do suco e de sua relação com os fãs. A associação de
Paulo Guina ao meme também aparece no [registro do Sequelanet](https://www.sequelanet.com.br/2015/09/meme-pai-de-familia-jailson-mendes-ai-que-delicia.html).
Essas são referências do meme; a ilha, cargos, contratos e conflitos são ficção
cômica do jogo. Fotografias e vídeos externos não foram incorporados aos assets.

Foram reaproveitados os **20 áudios originais ElevenLabs já existentes**: três
trilhas, efeitos, ambiente e falas interpretadas por voz de biblioteca. As novas
ações usam esse material, com volume, mute e suspensão na pausa. A revisão não
precisou acessar uma nova credencial, clonar uma voz ou baixar músicas comerciais.

## Verificação e reprodução

```sh
npm run dev -- --host 127.0.0.1 --port 3030
npm run check
npm run size:build
```

O empacotador incremental e a cena podem ser reproduzidos com:

```sh
blender -b --python tools/delicia/enrich_island.py
python tools/delicia/package_assets.py
```

Os testes específicos estão em `tests/delicia-campaign.test.ts` e
`tests/delicia-production-v2.test.ts`. Cobrem travessia física de todos os percursos,
vitória dos dois bosses desde o spawn, válvulas, colisões, elevadores, jatos,
prensas, regeneração de plataformas, ondas ritmadas, mudança de fase, saves,
medalhas e integridade de mídia. A auditoria geométrica isola inimigos e prensas;
os testes separados exercitam seus comportamentos reais.

`scripts/verify_delicia.cjs` cobre teclado, pausa, persistência, vinte decodificações
de áudio, mapa World, toque e navegação. `scripts/verify_delicia_production.cjs`
cobre a versão compilada sem o global de debug. Ambos usam perfis isolados e
identificam explicitamente os casos de posição/save arranjados. Configure
`PLAYWRIGHT_LIB` e `CHROMIUM_PATH` com instalações existentes. Relatórios e capturas:
`output/delicia/v2/`.

O pacote publica **13 WebP e 20 áudios Opus** da expansão. O limite documentado do
projeto passa a 53.000.000 bytes para comportar os novos assets. PNG, MP3, Blender
e GLB permanecem fora do deploy. A entrega é local; a validação automatizada e as
capturas não equivalem a um playtest humano prolongado ou certificação de estúdio.

### Resultado final desta revisão

- `npm run check`: **1.438 testes TypeScript e 3 testes JavaScript passaram**;
  validação de níveis, sprites e mundo, os dois projetos TypeScript e build Vite
  concluídos com código de saída 0. Log: `output/delicia/v2-final-check.log`.
- Os **21 testes específicos da expansão** estão incluídos nessa suíte.
- Navegador de desenvolvimento: teclado, queda/respawn, checkpoint, áudio, mapa
  World e toque aprovados, sem erros; `output/delicia/v2/browser-report.json`.
- Navegador de produção: seis cenários representativos, os dois chefes, pausa,
  caderno e carregamento dos novos atlas aprovados, sem erros; o global de debug
  está ausente. Evidências: `output/delicia/v2/production/report.json` e capturas
  no mesmo diretório. O save de desbloqueio usado nessa inspeção é sintético.
- Build: **51.275.190 bytes em 207 arquivos**, com 1.724.810 bytes de margem no
  limite de 53 MB. Detalhamento: `build-size-v2.json`. A mídia da expansão soma
  **7.595.663 bytes**; PNGs e modelos editáveis ficam fora do pacote publicado.
- A ilha Blender revisada contém **2.841 objetos e 20 materiais**. O render final
  de 2.400 × 1.500 foi inspecionado, assim como os cenários no build de produção.

Prévia local do pacote compilado: `http://127.0.0.1:3031/delicia.html`.
Nenhuma publicação remota foi feita nesta revisão.
