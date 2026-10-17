# Guaíra — exploração, retorno e progresso

Revisão de 17/10/2026. Continuação dos desvios de manutenção, sem substituir os desafios ou o motor nativo.

## Problemas encontrados

- As moedas apareciam apenas no contador da tentativa. Ao voltar ao mapa, não havia registro de quais desvios tinham sido explorados nem de quais recompensas faltavam.
- A câmera mudava a direção horizontal durante o retorno, mas procurava os próximos apoios de descida apenas à direita.
- A seleção de avisos também favorecia a direita. Na volta pelo Alto do Coletor, a descarga à esquerda merecia o aviso antes do contato.
- As conclusões do capítulo já eram salvas, mas era necessário distinguir coleta real, visita concluída, abandono e repetição antes de registrar exploração.

## Mudanças no jogo

Os oito desvios têm contagem própria no HUD já existente. O título e o contador ocupam a primeira linha; a segunda continua reservada ao perigo ou à ação imediata. Não há painel novo cobrindo os saltos.

Ao concluir a fase, o mapa principal e a Jornada passam a mostrar as moedas distintas encontradas em cada desvio. É possível completar as descobertas em visitas posteriores. Recolher a mesma moeda de novo não aumenta esse registro. A exploração permanece opcional e não substitui nenhuma das cinco conclusões exigidas para seguir a campanha.

O registro consulta as identidades coletadas pela colisão nativa. Somar moedas ao contador, selecionar um lugar, entrar numa fase ou eliminar seu guarda não basta. Uma tentativa abandonada não registra suas novas descobertas. A morte e o checkpoint mantêm as regras da tentativa; as descobertas só são registradas quando ela termina. Concluir e pausar antes de sair também funciona.

Ao voltar, a câmera considera os apoios reais à esquerda, incluindo andaimes anteriores e o estado das tábuas que cedem. Os avisos procuram o perigo na direção do deslocamento. Uma freada curta mantém a orientação anterior para evitar oscilações.

## Percursos conferidos

| Fase | Desvio principal | Retorno verificado |
|---|---|---|
| Travessia | Varanda do Arroz | Da varanda à sacada intermediária, ao apoio de entrada e à taipa |
| Pátio | Passadiço das Docas | Da patrulha às docas; nova subida para cruzar o canal e continuar |
| Respiros | Ponte do Reservatório | Pela tábua frágil e pelos andaimes da oficina até a margem |
| Subida | Beiral da Portaria | Pelo beiral que cede até o apoio de entrada, acima da investida |
| Galeria | Viga de Inspeção | Pela viga frágil e pelos apoios da oficina até o caminho baixo |
| Alívio | Alto do Coletor | Pelo apoio estreito, esperando o intervalo seco antes de voltar sobre o ramal |

Os seis percursos começam na entrada real, recolhem as moedas do desvio, retornam pelos apoios e seguem até a chegada. Nenhum depende de dano, teletransporte ou alteração do relógio. Os dois desvios de manutenção continuam testados com válvulas, guardas, morte e retorno. A rodada não aumenta o comprimento das fases nem a quantidade de inimigos.

## Verificação e limites

- 3.566 testes TypeScript aprovados, nenhum reprovado; um teste opcional de canvas foi executado separadamente e passou. Três testes de servidor também passaram.
- 12 execuções de ida e volta no motor nativo: seis fases, com e sem redução de movimento. Verificação de colisões, coleta, conclusão, enquadramento e renderização sem alterar a simulação.
- Oito rotas passam pelo host real, coleta, conclusão pausada, mapa e recarregamento. Testes adicionais cobrem importação inválida, união de descobertas entre abas e abandono.
- Navegador: teclado e toque simulado, pausa, salvamento, mapa e recarregamento em telas de computador e celular. Os perfis de inspeção são isolados; a campanha normal é conferida separadamente, com nove execuções e controle via Gamepad API simulado.
- As gravações completas usam física a 60 Hz e captura a 30 fps, sem áudio. Os vídeos curtos são recortes dessas mesmas execuções.

Os percursos são ensaiados. Eles demonstram acesso, retorno, coleta e conclusão; não medem a facilidade de descoberta, a dificuldade percebida ou a diversão de uma primeira partida. Essas questões continuam dependendo de observação de jogadores sem conhecimento prévio das fases.

Resultados, medidas e arquivos de origem estão em [exploration-return-verification.json](exploration-return-verification.json). A [revisão visual](index.html?rev=retornos-2026-10-17#exploracao) reúne os seis retornos e seus vídeos completos.
