# Guaíra: interface integrada

A entrada da campanha é `guaira-capitulo.html?campaign=1`. Ela usa
`GuairaChapterApp` e `GuairaChapterMapView`; não é a página livre `guaira.html`
nem uma das páginas de laboratório. O mapa continua sendo a maquete de Guaíra,
com o mesmo modelo de estradas, caminhada, chegadas, água e destinos.

## Interface

- O mapa mantém o nome, progresso, **Jornada**, destino atual e ação principal.
- **Jornada** reúne as etapas, o desvio do Bairro, a abertura alternativa,
  panorama, som e viagens para Fábrica/Serra. Nenhuma dessas funções foi removida.
- `Esc` abre/fecha Jornada. O diálogo nativo preserva foco e interrompe a
  caminhada e o áudio ambiente. Trocar o panorama fecha o diálogo para mostrar
  o resultado; selecionar uma etapa continua exigindo chegar e entrar.
- História, recibo de gravação e conclusões opcionais ficam na Jornada.
  Problemas de armazenamento continuam visíveis no mapa e durante o jogo.
- As placas usam o mesmo `workshopPanel` e a paleta Oficina de World, com
  tipografia bitmap, alvos nativos de pelo menos 44 px, foco visível,
  texto acessível e alternativa para cores forçadas/Canvas indisponível.
- Durante uma tentativa, a interface externa mostra a orientação contextual e
  **Pausa**. Ajuda, recomeçar, mapa/Bairro, som e referência de teclas ficam
  disponíveis ao pausar ou concluir. O HUD e os controles de toque próprios de
  cada trecho continuam intactos.

## Limites e verificação

Não há mudanças em física, arte da maquete, posições, câmeras, cronologia,
recibos, desbloqueio de desenvolvimento, salvamento ou recursos de outros
projetos. Os tokens existentes de navegação, tentativa e ação continuam sendo
verificados. Os controles movidos para Jornada só funcionam na instância aberta
atual do diálogo; callbacks retidos não ganham nova autorização ao reabri-lo.

Dependência de implementação: `WorldWorkshopUI.ts`, introduzido no trabalho
Oficina (`c6b8d730`). O ajuste posterior de foco (`56af620`) deve acompanhar a
integração, sem alterar o contrato do painter.

Verificações locais: os dois projetos TypeScript passam. 285 testes focados
passam, incluindo o host, mapa, controles, armazenamento, ciclo de vida,
acionamento repetido, interrupções de foco, as cinco etapas reais pelas duas
aberturas (teclado/toque) e Galeria/Câmara de Alívio. Os testes instrumentam as
fronteiras de DOM, Canvas e dispositivos; eles não provam CSS no navegador.

Antes de publicar, conferir a versão integrada em navegador real:

1. Mapa novo e restaurado em desktop, 320 px de largura e paisagem curta;
   verificar maquete, destino, Jornada, entrada e alertas de armazenamento.
2. Abrir/fechar Jornada por toque, Tab/Enter/Espaço e Esc; conferir foco,
   rolagem do diálogo, panorama, som e as viagens de campanha.
3. Selecionar a abertura alternativa e um desvio, caminhar, interromper o
   movimento com Jornada, fechar e chegar sem entrar automaticamente.
4. Jogar, pausar, abrir/fechar ajuda, retomar, recomeçar e voltar ao mapa.
   Repetir na Galeria/Câmara de Alívio e verificar o objetivo da outra rota.
5. Conferir aviso de falha de armazenamento, carregamento falho, recarga,
   ida/volta da página, movimento reduzido e cores forçadas.

A validação visual responsiva e o gate completo de publicação são etapas
separadas dessas verificações focadas.
