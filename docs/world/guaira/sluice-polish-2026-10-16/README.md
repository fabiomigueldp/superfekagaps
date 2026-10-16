# Guaíra — pontes, roldanas e comportas

Revisão de 16/10/2026 da Travessia, aplicada aos renderizadores usados tanto pelo
capítulo integrado quanto pelo laboratório. [Abrir comparativo](index.html).

## Problemas corrigidos

- As correntes começavam no ar, terminavam em uma altura fixa e podiam ficar
  desconectadas do tablado ou continuar abaixo dele. Agora há fundações nas duas
  margens, braços de suporte, mancais e roldanas. As correntes chegam às ferragens
  da plataforma em toda a subida; os elos se deslocam junto com ela.
- As roldanas giram pelo deslocamento real do corpo. Não existe outro ciclo de
  animação que possa continuar rodando depois que a ponte para.
- O canal final tinha água e correntes, mas não uma comporta visível. Recebeu
  reservatório, caixa de alvenaria, portão, queda d’água e canal para o arrozal.
  A altura da margem direita continua distinta, conforme os tiles originais.
- O arrozal final respondia à primeira ponte. Seu fluxo e a poça final agora
  respondem à segunda ponte, incluindo o reinício e o retorno por checkpoint.
- A abertura do portão alterava a origem dos reflexos da queda d’água. A origem
  agora permanece fixa: abrir o portão apenas revela mais água em movimento.
- Água, vegetação e trabalhadores da Travessia usam o relógio de simulação
  durante a partida. Impacto, reaparecimento e pausa congelam sua apresentação.
  Após a conclusão, um pequeno acumulador visual mantém a água ambiente viva,
  sem atualizar objetos, pontuação ou duração do percurso; a pausa o interrompe.

## Arte e autoridade do jogo

Pixel art na resolução nativa de 320 × 180. A base usa os materiais de Guaíra:
terra, madeira, pedra quente e metal envelhecido. A borda clara das plataformas
continua restrita ao tablado real. As fundações encostam nas margens sem cobrir
o topo sólido dos tiles. A pintura permanece atrás do personagem.

`GuairaSluiceArt.ts` reúne as peças das duas travessias. A altura do portão usa
`home`, `to` e a posição atual de `MovingBody`; correntes e roldanas usam esse
mesmo corpo. Colisão, velocidade de subida, controles, fases, checkpoints e
trajetórias permanecem sob a autoridade do motor nativo.

## Validação

- **903 testes de Guaíra aprovados**, incluindo dez casos novos para as correntes,
  os apoios, a borda jogável, a rotação, a câmera fracionária, o fluxo, a segunda
  válvula, as interrupções da simulação e a água após a conclusão.
- `npm run build` aprovado: validações de fases, assets do personagem e mundo,
  os dois projetos TypeScript e o build Vite.
- Dois percursos completos com teclado nativo e capacete intacto: taipas,
  **1.048 atualizações / 262 capturas**; manutenção, **1.074 / 269**.
  A simulação roda a 60 Hz e a gravação amostra a 15 quadros por segundo.
- Seis poses comparativas e duas animações de quatro segundos a 30 quadros por
  segundo. São enquadramentos preparados para inspeção da arte; não são prova
  de progressão. Os vídeos de percurso usam entradas reais sem editar corpos,
  câmera, jogador ou relógio.
- O teste de pintura confere repetição, ausência de mudanças no estado do jogo
  e estabilidade dos detalhes ambientais com movimento reduzido.

Relatórios: [arte e percursos](detail-verification.json),
[capítulo no navegador](browser-verification.json),
[página de revisão](review-verification.json).

O navegador usa um perfil isolado. As oito fases são abertas explicitamente
para conferir teclado, pausa, tamanho do canvas e retorno ao mapa. Isso não é
uma campanha completa nem uma medição em dispositivo físico.

## Reprodução

```powershell
node --import tsx scripts/prove_guaira_sluice.ts output/guaira/sluice-polish-2026-10-16 CAMINHO_DO_CANVAS docs/world/guaira/sluice-polish-2026-10-16/baseline-source
$files = @(rg --files tests -g 'guaira*.test.ts' -g 'guaira*.test.mjs')
node --import tsx --test --test-concurrency=4 @files
npm run build
```

`baseline-source/` preserva as fontes imediatamente anteriores a esta rodada.
Os hashes estão no relatório. Os comparativos usam o mesmo estado preparado
com as duas versões da arte. PNGs são congelados antes da composição da prancha
para evitar que uma referência de canvas mutável altere o quadro anterior.
