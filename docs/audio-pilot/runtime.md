# Integração do áudio pré-produzido

O catálogo `ArcadeAudioPack.ts` usa arquivos realmente recebidos e medidos.
`WorldGame.load` passa o ID da cena ao `WorldAudio`, preservando regras de jogo,
física, progresso, chefes e seus tempos de reação.

## Mapeamento ativo

| Cena/evento | Entrega |
| --- | --- |
| Travessia, Pátio e Galeria de Guaíra | Música A: trecho 8–32 s, loop de 24 s |
| Subida e Respiros | Música B: trecho 6,6667–33,3333 s, loop de 26,6667 s |
| Guaíra, fábrica 3-1…3-5 e Turbosuco | Salto, aviso e pressão com variantes A/B |
| Fábrica e Turbosuco | Descarga viscosa A/B em `jet`/`cannon` |
| Jatos de água limpa de Guaíra | Preservam o efeito procedural; não recebem descarga de suco |
| Mapa do capítulo, junto à fonte | Água A somente com recibo aceito do Prefeito; Água B disponível para revisão |
| Turbosuco em combate, junto à máquina | Suco A, ou B no estado de fúria; cancela em morte/resultado/saída |
| Chefes e cenas sem música cadastrada | Trilha procedural existente |

Loops usam crossfade de preroll sem encurtar o período. Os cortes retiram a
abertura baixa de B e os encerramentos dos originais. Música foi ajustada por
ganho linear para aproximadamente −18,5 LUFS antes da compressão; não houve
compressor de dinâmica. Saltos têm 180 ms; avisos são duas batidas, com a segunda
transposta três semitons; pressão tem 520 ms; descargas têm 380/280 ms. Os
parâmetros exatos, formatos, níveis pós-codec e hashes estão no manifesto.

Música: MP3 estéreo, 48 kHz/192 kbps. SFX/ambientes: PCM16 mono/48 kHz; o pequeno
tamanho permite decodificação simples e evita padding nos loops curtos. Masters
FLAC 24-bit são preservados fora de `public`, com a limitação da fonte MP3 explícita.

## Reprodução e lifecycle

O carregador só busca arquivos locais depois que o AudioContext está em execução.
Carregamento/falha mantém o sintetizador atual. A música gravada o substitui
somente após decodificação e validação do loop, encerrando notas antigas. Erros
não causam retries a cada frame. O arredondamento de até dois frames no resample
do navegador é tolerado; limites de loop incorretos continuam usando fallback.

Efeito indisponível toca o fallback imediatamente; terminar de carregar nunca
reproduz aquele evento atrasado. Variantes alternam sem usar o RNG do gameplay.
Há limite de seis vozes de efeitos e repetição do mesmo cue encerra a anterior.
O evento `pressure` toca aviso imediato e agenda a pressão 240 ms depois, como
edição sonora. Somente o evento real `jet`/`cannon` dispara a descarga e cancela
aviso/pressão anteriores. Não há timer de áudio governando dano ou progresso.

Pausa, mute, efeitos em zero, morte e troca de cena cancelam efeitos, incluindo
notas futuras do fallback. Música pausa no relógio do AudioContext. Dispose
aborta fetches, limpa buffers e desconecta fontes. O áudio de ambiente do mapa
não cria timer/RAF próprio. O botão SOM/MUDO e a tecla M preservam o mute entre
mapa e cenas pelo estado já existente do capítulo.

`publicWaterAudioLevel` observa o mesmo recibo aceito usado pela água desenhada,
o ID da sessão e a distância à fonte. Seleção, visita, vitória ainda não aceita,
outro capítulo e distância grande não ligam o som. Menus, aba oculta e perda de
foco suspendem o ambiente. A intro Turbosuco mantém seus cues procedurais.

Os buses e controles existentes continuam valendo: música `.14`, efeitos `.3`,
voz `.22`, com ganhos adicionais registrados no catálogo. Voz gravada existente
não foi modificada. Não foi adicionado ducking ou limitação agressiva.

## Trabalho paralelo e limites

A branch de áudio foi reaplicada sobre a integração central
`ab942feedde5edc0c735ed93b34647c1145c6a42`. O único conflito foi a região do novo
botão de som ao lado do texto de saída. Foram preservados “seleção de experimentos”
e os novos guards de abertura/navegação da integração. Todos os demais arquivos
das nove frentes permanecem intactos em relação à base central.

Além dos módulos de áudio, os pontos de ligação são uma linha em `WorldGame.load`,
a identificação/ambiente do laboratório Turbosuco e o estado/controle de áudio
do mapa em `GuairaChapterApp`/`GuairaChapterMapView`. Não há acesso a Oracle,
merge em main ou deploy. Falta audição artística; não se declara que os loops
soam naturais ou que o acabamento final foi aprovado só com testes técnicos.
