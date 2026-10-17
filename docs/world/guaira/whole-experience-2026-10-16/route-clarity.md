# Guaíra — risco legível, descidas e novas tentativas

Revisão de 17/10/2026, após a [expansão das fases](course-design.md) e os
[seis desvios altos](exploration-polish.md).

## O que esta rodada encontrou

Percorrer uma rota ensaiada não basta para conferir seu funcionamento. Esta
passagem incluiu esperar antes de avançar, permanecer nas tábuas frágeis,
cair para o piso inferior, frear durante uma descida e morrer depois de
recolher as moedas do desvio.

O problema mais importante estava no motor: apenas o centro dos pés acionava
uma tábua frágil. Quando essa tábua desaparecia, a borda de outra podia
continuar sustentando o personagem indefinidamente. Isso retirava o risco
de alguns apoios rachados dos Respiros e do Alívio.

A câmera também mostrava o próximo patamar sem necessariamente mostrar a
margem depois do último apoio. E o nome do desvio desaparecia antes de sua
descida terminar; uma pequena freada podia produzir um aviso de retorno.

## Mudanças no jogo

- **Tábuas com consequência real:** todos os apoios sob os pés recebem contato,
  incluindo uma borda sob apenas um pé. A correção é compartilhada pelo modo
  clássico e pelo World. Os tempos nativos de aviso, queda e reaparecimento
  continuam os mesmos; uma plataforma vizinha sem contato permanece intacta.
- **Antecipação visual:** a rachadura abre antes da ruptura. A queda separa a
  madeira em dois fragmentos, com afastamento e desaparecimento graduais. A
  abertura da rachadura continua visível com movimento reduzido. O aviso
  “Tábua cede — continue” acompanha o contato real.
- **Descidas com destino visível:** a câmera inclui a margem final entre os
  apoios que antecipa. A sacada existente da Subida também integra essa leitura.
  Há mais espaço acima do jogador para absorver saltos e rebatidas; a antecipação
  da descida avança no máximo oito pixels por atualização a 60 Hz.
- **Orientação estável:** o nome do caminho alto acompanha sua descida até o
  retorno ao piso. Câmera e orientação compartilham a mesma decisão de direção;
  frear brevemente não anuncia uma volta. Um salto passageiro pela rota baixa
  não basta para registrar a escolha de um desvio.
- **Recuperação nos Respiros:** ao cair na plataforma inferior, a câmera revela
  o chão da oficina e a orientação chama atenção para a margem. É possível
  descer, enfrentar a patrulha no piso e continuar, ou tentar a subida novamente.
- **Pontos seguros:** a descrição junto à bandeira explica que o ponto vale
  durante a tentativa e que sair e reentrar reinicia a fase.

## Conferência por fase

| Fase | Descida conferida | Situação adicional |
|---|---|---|
| Travessia | Varanda, patamar e margem do registro | Morte posterior às moedas e retomada no ponto conquistado |
| Pátio | Passadiço, dois patamares e margem da comporta | Esperas antes da subida e retomada após atravessar a ponte |
| Respiros | Reservatório, sacada e margem das taipas | Tábua cede; apoio baixo permanece utilizável e mostra o piso |
| Subida | Beiral, sacada existente e margem antes do canal | Tábua cede; queda retorna à rota do investidor |
| Galeria | Viga, duas sacadas e piso antes das tábuas | Tábua cede sobre a área do respiro; saída pelo piso conferida |
| Alívio | Coletor, dois apoios e margem do checkpoint | Tábua estreita cede, mantendo possibilidade de recuperação |

As seis rotas altas foram repetidas com quatro esperas diferentes, de 1,5 a
10 segundos, nos pontos de aproximação. As 24 execuções chegaram ao fim sem
dano, com todas as moedas do desvio e seu guarda vencido. Na Subida, essas
esperas ocorrem antes da zona de aquisição do investidor: permanecer parado
dentro de sua faixa de ataque continua sendo perigoso e não é tratado como
área segura.

Nas quatro rotas com tábuas frágeis, a permanência no apoio produz uma queda
real, seguida de continuação até o fim sem dano obrigatório. Há também seis
verificações de morte posterior ao desvio: a tentativa retorna ao checkpoint
conquistado, conserva as moedas já recolhidas e não permite recolhê-las outra vez.

## Integração e limites da evidência

A revisão inclui verificações do motor compartilhado, teclado e toque
simulado, pausa, movimento reduzido e renderização sem alteração da simulação.
Os vídeos vêm das entradas e da física nativas; os clipes de queda mostram
trechos de execuções completas. Os resultados finais e os hashes dos arquivos
conferidos estão em [route-clarity-verification.json](route-clarity-verification.json).

Algumas verificações antigas ainda contavam apenas os mecanismos ou checkpoints
da versão curta de Guaíra. Foram atualizadas para distinguir os três transportes
autônomos da nova ponte acionada por placa e conferir o checkpoint final da
fase expandida. O teste do primeiro investidor da campanha agora freia antes
da decolagem curta sobre a ponte frágil, sem depender da borda que antes não
cedia; mantém as exigências de aviso, observação e contra-ataque.

Estas são execuções automatizadas e inspeções visuais. Elas demonstram os
comportamentos descritos, mas não substituem primeiras partidas externas para
calibrar descoberta, diversão e dificuldade percebida.
