# Guaíra — conexões e água em movimento

Revisão de 16/10/2026, aplicada à arte nativa da Travessia e dos Respiros.
[Abrir comparativo](index.html).

## Mudanças

- Os quatro tubos inclinados da Travessia receberam visores, juntas e sombras
  consistentes com a rede das oficinas. As bocas encontram a altura da água nos
  canais. Os reflexos percorrem a inclinação sem reiniciar em cada braçadeira.
- O sentido do fluxo acompanha a ligação: saídas para a vila e os arrozais,
  entrada para a comporta final. Essa entrada recebe a primeira válvula; a saída
  permanece seca até a segunda ser acionada.
- As ondas das poças partem do eixo da queda, inclusive quando ele não coincide
  com o meio da poça. A fase deixou de depender da margem esquerda.
- Uma região pequena de espuma, com seis poses, liga a queda à superfície. Ela
  permanece dentro da água, desaparece com o circuito seco e congela com a
  preferência de movimento reduzido. Sua paleta não usa as cores dos jatos
  perigosos.
- A alimentação dos Respiros ganhou uma conexão na parede da estação, duas
  curvas com visores e uma descida até o trecho enterrado junto à grelha.
  Os quatro manômetros têm ligações curtas na base, abaixo da água perigosa.
- Os pequenos sinais nas laterais das grelhas agora mantêm a seta no primeiro
  instante de subida, mesmo quando a altura arredondada do jato ainda é zero.
  O ponto de exclamação continua seguindo a presença real de água com dano.

## Integração

As mudanças são usadas pelo capítulo e pelos laboratórios. Não há animação
paralela de mecanismos: os estados vêm dos objetos nativos e o tempo vem da
simulação. A preferência de movimento reduzido interrompe detalhes ambientais,
preservando a informação de pressão e a posição real das plataformas.

Os tubos inclinados são compilados uma vez em pixels do mundo. Faixas horizontais
iguais são agrupadas na pintura. As curvas da estação usam o mesmo módulo de
tubos empregado no Pátio e na Câmara de Alívio. A pintura mantém as bordas reais
de terreno e plataformas, o personagem, a colisão e os tempos dos mecanismos.

## Conferência

- **909 testes de Guaíra aprovados**, incluindo seis novos casos de continuidade
  dos visores, abastecimento separado, origem das ondas, limites da espuma,
  encaixes da estação e sinais no início da subida dos quatro jatos.
- `npm run build` aprovado, incluindo validação de fases, sprites e mundo, os
  dois projetos TypeScript e empacotamento Vite.
- Três percursos completos sem dano: taipas, **1.048 atualizações / 262 quadros**;
  manutenção, **1.074 / 269**; Respiros, **877 / 220**. Entradas nativas a 60 Hz,
  captura a 15 quadros por segundo. A preparação dos Respiros usa também o único
  passo inicial do replay original.
- Dez comparações estáticas e três animações a 30 quadros por segundo: quatro
  segundos em cada comporta e um ciclo de 4,2 segundos nos Respiros.
- As capturas comparam as duas versões sobre o mesmo estado preparado. Esses
  enquadramentos são inspeção da arte, separados dos percursos de teclado.
  A pintura é repetível e não altera objetos, jogador, câmera ou progresso.

Relatórios: [comparações e percursos](detail-verification.json),
[capítulo no navegador](browser-verification.json),
[página de revisão](review-verification.json).

O navegador usa perfil isolado. A inspeção abre as oito fases para conferir
teclado, pausa, estabilidade do canvas e retorno ao mapa; nos dois cenários de
jatos, a pausa é conferida durante uma descarga. Isso não representa uma
campanha completa ou uma medição em dispositivo físico.

## Reprodução

```powershell
node --import tsx scripts/prove_guaira_connections.ts output/guaira/connections-polish-2026-10-16 CAMINHO_DO_CANVAS docs/world/guaira/connections-polish-2026-10-16/baseline-source
$files = @(rg --files tests -g 'guaira*.test.ts' -g 'guaira*.test.mjs')
node --import tsx --test --test-concurrency=4 @files
npm run build
```

`baseline-source/` guarda os arquivos antes desta rodada. O relatório registra
os hashes das versões anteriores usadas pelos comparativos. As imagens de cada
versão são congeladas em PNG antes de montar pranchas e vídeos, sem reter uma
referência de canvas que possa ser alterada pela pintura seguinte.
