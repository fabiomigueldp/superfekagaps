# Retorno dos selos baixos em Cabos Cruzados e Travessia do Alto

## Diagnóstico corrigido

As bacias de 4-3 e 4-4 não são impossíveis de sair. O degrau original está
em (106,17), enquanto o próximo chão está em (110,9): 128 px de subida para
um salto normal que sobe cerca de 103 px.

Uma busca inicial limitada não encontrou retorno. Ao incluir corrida na borda,
a janela de coyote e a posição real da cabine, apareceram trajetos válidos.
As melhores sobreposições de embarque dessa busca foram 4,43 px em 4-3 e
13,78 px em 4-4. São resultados da busca, não limites matemáticos globais.
A regressão reproduz uma corrida real de 12 quadros, salto depois de sair da
borda, embarque sustentado, viagem e desembarque no chão original. Não depende
de supor que encostar por um quadro já prova a fuga.

O problema é de leitura e exigência: o degrau parece apontar para o alto,
mas o retorno antigo pede correr para trás, sair da borda e acertar a cabine.
Isso é uma exigência pouco clara após uma recompensa opcional numa bacia baixa.

## Mudança mínima

Cada fase recebe três tiles de plataforma de mão única em (107..109,13).
O selo, o chão inferior, o degrau existente e o chão principal não mudam.
A sequência passa a oferecer três subidas de 64 px; a visita opcional ainda
custa descida, deslocamento e três saltos. Não há selos ou moedas extras.

O novo degrau fica sob a estrutura da estação. Toda a trajetória da cabine e
seu passageiro passa acima dele; a menor folga entre o convés e o degrau é maior
que 56 px. Movimentos, períodos, montagens, inimigos, checkpoints, saídas,
indicadores de rota e decorações continuam iguais.

## Evidência

- `campaign-basin-recovery.test.ts` usa `WorldGame.update`, jogador, inimigos,
  máquinas e coleta reais. Parte da chegada local à bacia, coleta o selo e
  retorna ao chão principal, sem teleporte entre passos, invulnerabilidade,
  desativação de máquinas ou selo inserido no save.
- 360 percursos: duas fases × 20 instantes de chegada da cabine × três posições
  de aproximação (−8/0/+8 px; −4/0/+4 px nos degraus) × três durações de pulo
  (9/10/11 quadros). Todos terminam em chão seguro e continuam apoiados por
  mais 30 quadros. Uma cabine que passa durante o salto continua sendo apoio
  válido; não foi removida da simulação.
- O mesmo roteiro de saltos comuns falha sem o degrau novo. A alternativa
  histórica de coyote + cabine também passa e impede chamar a bacia antiga
  de matematicamente inescapável.
- `prove_campaign_basin_recovery.ts` produz vistas nativas antes/depois com o
  Canvas de produção. São câmeras/jogador posicionados para inspeção, não teste
  de navegador/dispositivo nem travessia completa a partir do início da fase.
- O diff de dados contém exatamente seis mudanças EMPTY → PLATFORM, três por
  fase. Os selos conservam IDs e coordenadas e todos os guias calibrados de
  moedas continuam intactos.

A validação focada inclui retornos, chegada, guias de moedas, praia inicial,
trajetórias e embarques de todas as cabines, contagem de tentativas e saves.
O gate completo e a publicação ficam com a integração.

Resultado focado: 286 testes passaram, ambos os projetos TypeScript passaram e
`validate_world.ts` validou as 30 fases e os 260 frames. Vistas `attachment`
mostram o fim do degrau encostando na borda inferior do banco existente.
