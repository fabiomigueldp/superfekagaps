# Pátio das Comportas: escolha no ramal A

## Conteúdo

A abertura alternativa mantém 60 × 28 tiles, duas placas de sentada, dois
elevadores, o mesmo checkpoint e o recibo `junction-clear`.

- O tabuleiro A dá acesso a um pequeno patamar de manutenção (x176–224,
  topo y176), com três moedas nativas. O jogador pode visitar antes de trocar
  para B, ou voltar à placa do ponto seguro e inverter B → A para buscá-las.
- A margem do arrozal oferece uma área firme de chegada (x736–800), um vão
  de 48px (x800–848) e a margem final. É um salto normal, sem relógio: cair
  continua levando ao piso seco de recuperação.
- A pista “A: MOEDAS” fica pendurada abaixo do patamar, visível de A. No alto,
  o texto mostra a coleta e orienta o retorno pela direita. A plantação não
  atravessa visualmente o vão final.
- Não há mecânica, moeda, esquema de progresso, saída ou ID de mecanismo novo.

## Recuperação e câmera

A morte nativa conserva as moedas obtidas e seus IDs na tentativa. A mesma
semântica foi aplicada ao helper interno `returnToSafePoint`; nenhum botão
novo foi adicionado. Recomeçar por `load` continua limpando a coleta.

Um segundo salto imediatamente ao tocar o patamar revelou que a interpolação
de câmera podia deixar o capacete atrás do HUD. O ajuste local limita somente
a câmera vertical depois do update nativo, mantendo 48px acima da posição do
jogador. Não modifica posição, velocidade, gravidade ou altura do salto.

## Evidências focadas

Comando executado: `node --import tsx --test tests/guaira-junction.test.ts tests/guaira-junction-feedback.test.ts`

Resultado: **25 testes passaram**.

- Rota direta: 893 frames de Input nativo, duas sentadas, transporte nos dois
  elevadores e salto final; conclusão sem moedas em teclado e toque.
- Rota opcional: 1838 frames gravados, solicitações A → B → A → B, três moedas,
  retorno ao meio e conclusão. Testes também inserem 1200 frames (20s) de espera
  apoiada no patamar sem punição ou mudança de resultado.
- Queda real ao omitir o salto final conserva três moedas e permite voltar à
  entrada andando pelo piso seco e saltando pelo degrau.
- Morte e retorno ao ponto seguro conservam a coleta uma única vez; revisitar
  o patamar não duplica moedas. O estímulo de morte usa `Player.die('fall')`;
  essa parte não afirma uma morte produzida por um perigo do cenário.
- Re-salto imediato e reversões aéreas esquerda/direita em teclado e toque
  preservam o capacete abaixo do HUD. Revisão independente também refez essas
  seis variantes e encontrou margem mínima de 44px.
- Pausa, blur, toque cancelado, movimento reduzido, recuperação A/B e repetição
  das placas continuam cobertos pelos testes focados existentes.

## Rasterização real do renderizador de produção

`node --import tsx scripts/prove_guaira_junction_depth.ts /tmp/guaira-junction-depth-proof /path/to/@napi-rs/canvas/index.js`

O script executou quatro rotas: direta/opcional × movimento normal/reduzido,
com Input de toque nativo. Captura 24 quadros, duas provas de re-salto imediato,
quatro folhas de contato e um manifesto com hashes. O salto final tem as duas
bordas do vão visíveis antes de sair do chão. Renderizar não altera o estado.
Nenhuma rota gravada injeta posição, checkpoint, coleta ou conclusão.

Imagens inspecionadas, obtidas do Canvas real:

- [Rota direta e salto final](guaira/patio-choice/direct-route.png)
- [Escolha de A e retorno com três moedas](guaira/patio-choice/optional-route.png)
- [Re-salto imediato sem capacete coberto](guaira/patio-choice/immediate-rejump.png)

Os limites de evidência são importantes: DOM e áudio são simulados; os pixels
vêm do renderizador de produção via `@napi-rs/canvas`. Isso não é QA em navegador
ou dispositivo, teste da barra DOM, áudio, carregamento de fontes ou medição de
FPS. A suíte completa, validações agregadas, typecheck e build pertencem à
integração final e não foram executados por este recorte.
