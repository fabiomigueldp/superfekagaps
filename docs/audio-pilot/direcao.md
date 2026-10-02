# Direção sonora

Uma aventura cômica instrumental híbrida: o mundo tem textura física, Feka tem
uma frase memorável e o humor aparece na atuação rítmica. O som sustenta a
clareza do pulo, do perigo e da resolução. Instrumentos não fingem ser alertas.
Evitar referência a artistas, celebridades, músicas existentes ou vozes reais.

## Motivo Feka proposto

Frase de cinco notas, um compasso de 4/4: graus **1–3–5–2–1**, por exemplo
**Ré4–Fá♯4–Lá4–Mi4–Ré4**, com colcheia, colcheia, semínima, colcheia e semínima
pontuada. A subida é confiante; o retorno rápido é o pequeno tropeço cômico.
A resposta pode ser um compasso de silêncio melódico com baixo/percussão.

É uma proposta autoral escrita para este pacote, ainda sem composição gravada
ou exame de semelhança. As notas nos prompts são orientação, não garantia de
execução pelo modelo. Após escolher uma proposta, um editor/compositor confere
o motivo real e fixa transcrição, andamento, tonalidade e pontos de loop. Não
gastar tentativas indefinidas buscando precisão nota a nota por prompt.

## Paleta por lugar e personagem

| Núcleo | Instrumentação e gesto | Espaço para gameplay |
| --- | --- | --- |
| Guaíra | Violão de nylon/viola caipira secos, baixo redondo, madeira, pequenos metais abafados; assobios breves em respostas | Pouco reverb, frases separadas e transientes leves |
| Fábrica | Funk eletrônico industrial, baixo elástico, motor afinado discreto, síncopes mecânicas e timbre líquido grave | Percussão musical não usa os dois pips do aviso; máquina real fica legível |
| Turbosuco | Mesma família da fábrica; ostinato mais denso, registro e contratempo mais intensos | Intensidade vem do arranjo, sem ganho brusco; abre espaço para aviso e vulnerabilidade |
| Prefeito da Vazão | Marcha pomposa cômica, metais curtos/tuba leve, caixa abafada, pequenas pausas de constrangimento | Carimbo, registro e lacre continuam reconhecíveis; evitar fanfarra contínua |
| Mapa / vitória | Motivo Feka abreviado em cordas e madeira; resolução curta | Navegação recebe pouca densidade; vitória não dispara em cada revisita |

Guaíra mantém escala humana, sem clichê de festa ou caricatura regional. Água
pública tem movimento leve, claro e irregular; o suco roxo é denso, grave,
borbulhante e viscoso. Cor não produz som: a diferença vem de viscosidade,
ritmo das bolhas e duração do escoamento. Nada de corte, esmagamento, mastigação
ou espremedor de fruta. Tubo, válvula e líquido são a identidade industrial.

## Duas propostas de Guaíra para escolher

| Proposta | Alvo | Comparação desejada |
| --- | --- | --- |
| A — Caminho de casa | 40 s, cerca de 96 BPM, viola/violão respondendo, caminhada calorosa, baixo simples | Espaço, identificação do motivo e resistência à repetição |
| B — Pátio em movimento | 40 s, cerca de 108 BPM, síncope mais ágil, baixo com respostas, pequenos cliques metálicos | Movimento e humor sem perder a clareza dos efeitos |

Os prompts completos e parâmetros são a fonte única em
[pilot.json](../../tools/audio_offline/pilot.json). São **duas propostas totais**,
não duas propostas com duas gerações cada. Os trechos têm abertura, desenvolvimento
e retorno para facilitar edição. Nenhum loop perfeito está prometido pelo texto.
O assobio é textura não verbal e esparsa; nenhum canto, fala ou coro.

## Seis efeitos, duas variantes cada

| Cue | Pedido por variante | Papel e diferença A/B |
| --- | --- | --- |
| Salto do Feka | 0,5 s, one-shot | Madeira + subida de ar / metal abafado + elasticidade; um ataque só |
| Água limpa | 1,5 s, loop | Filete em canal / pingos mais definidos; leve e transparente |
| Suco roxo | 1,5 s, loop | Bolhas graves / sucção mais mecânica; viscosidade sem horror |
| Aviso de máquina | 0,75 s, one-shot | Dois toques ascendentes de metal oco / metal mais abafado |
| Pressão | 1,5 s, one-shot | Ar tenso + três pulsos / bomba com mais detalhe mecânico |
| Descarga | 1,0 s, one-shot | Baque pneumático + fluxo viscoso / válvula mais presente |

As durações são janelas de geração, não a duração que o gameplay deverá esperar.
O salto final pode ter 120–220 ms após edição. Pressão e descarga **não** vêm
embutidas no aviso: são cues separados para seguir os estados existentes sem
atrasar colisão ou alterar a janela de reação. Se o estado acabar cedo, cancela-se
o cue correspondente; nenhuma cauda agenda um ataque novo.

Os seis itens cobrem mobilidade, contraste água/suco e o ciclo inteiro da
máquina. Dano, coleta, checkpoint, bloqueio e lacre continuam com o vocabulário
atual durante o piloto; estão inventariados para a fase seguinte. Não substituir
todos os efeitos ao mesmo tempo antes de testar os pares críticos.

## Vozes originais depois do piloto

Eleven v4 (`eleven_v4`) é o modelo de síntese a avaliar. Voice Design é outra
operação: o endpoint atual oferece `eleven_ttv_v3` e
`eleven_multilingual_ttv_v2`, não `eleven_v4` como modelo de design.
Primeiro selecionar uma voz criada por descrição; só depois sintetizar as falas.
Essas informações foram conferidas no [catálogo oficial](https://elevenlabs.io/docs/overview/models)
e no [endpoint de Voice Design](https://elevenlabs.io/docs/api-reference/text-to-voice/design).

| Personagem | Brief para futura voz original, sem referência pessoal |
| --- | --- |
| Feka | Adulto brasileiro, registro médio, articulação ágil, confiança que vacila por um instante; humor pela pausa |
| Prefeito fictício | Adulto, registro médio-grave, dicção formal exageradamente cuidadosa, pompa que se desmonta; sem político real |
| Turbosuco | Esforços mecânicos e reações instrumentais no piloto; fala só se a cena futura precisar |

Esboço original para teste futuro de Feka, ainda sem envio: “Eu conferi o caminho.
Quer dizer, quase todo o caminho. Se essa ponte colaborar, chego do outro lado
com os óculos no lugar. Vamos com calma... e com um pouco de coragem.”

Não usar as gravações existentes como referência de clonagem, não enviar áudio
real de pessoas e não atribuir à documentação licença sobre as vozes do repo.
As falas atuais do João ficam preservadas; autoria/consentimento e uso comercial
continuam itens de verificação específicos, fora deste piloto sem voz.
