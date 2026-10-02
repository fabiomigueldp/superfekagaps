# Passagem dos Respiros · arte funcional

O pintor local usa o estado real de `jetCycle(body, objects.time)`. Não modifica física, mecanismos, materiais globais, arte dos chefes ou o relógio da simulação.

## Leitura do trecho

- As grelhas de latão e pedra acompanham a largura e a boca de cada mecanismo. Seus sulcos ficam abaixo da água perigosa
- Oito marcas de pressão enchem durante o aviso nativo. Uma régua fina na lateral de entrada repete o estado acima de y145, conservando o aviso quando os controles Canvas legados cobrem a frente da grelha
- A cortina pressurizada usa ciano saturado, faixas verticais e reflexos contidos no retângulo real. Toda a superfície perigosa permanece opaca, inclusive seus cantos e os frames de apenas um pixel
- A água ambiente do arrozal usa verde-turquesa suave. A névoa residual é clara, esparsa e separada da cortina; não usa nenhuma das cinco cores reservadas ao perigo
- Movimento reduzido congela somente arroz, trabalhadores, reflexos e névoa. Altura da água, pressão e avisos continuam acompanhando a simulação
- Trabalhadores reutilizam `GuairaWorkerArt`, nas margens seguras. Feka e a bandeira continuam no render nativo

A câmera da fatia fica em y144: a coluna máxima começa em y32, o piso fica em y160 e a régua frontal ocupa y169–173. O indicador lateral ocupa y111–140, com seta de carga acima. Os botões Canvas antigos ainda podem encobrir parte dos pés; a entrada moderna usa controles DOM separados de 44px. Essa limitação visual do fallback não altera o envelope físico.

## Verificações reproduzíveis

`node --import tsx --test tests/guaira-respiros-art.test.ts`

Seis testes cobrem os 252 frames de um ciclo nos dois mecanismos e nos modos normal/reduzido, primeiro/último pixel perigoso, câmera fracionária, largura fracionária, ausência de perigo visual durante aviso/névoa, pressão lateral acima dos botões, determinismo, restauração do estado Canvas e ausência de mutações. O pintor cobre conservadoramente cada pixel que intersecta o retângulo projetado; a engine normalmente já fornece câmera arredondada.

`npm run typecheck`

O gerador offline utiliza `@napi-rs/canvas@0.1.80` somente como ferramenta externa de prova. Não acrescenta dependência, raster ou pacote ao jogo:

```sh
npm install --prefix /tmp/feka-respiros-canvas --cache /tmp/feka-respiros-npm-cache --no-audit --no-fund @napi-rs/canvas@0.1.80
node --import tsx scripts/prove_guaira_respiros_art.ts /tmp/guaira-respiros-art-proof /tmp/feka-respiros-canvas/node_modules/@napi-rs/canvas/index.js
```

O quarto argumento opcional aponta para `GuairaRespiros.ts` quando mecânica e arte ainda estão em worktrees separados. A prova instancia o adapter real, com `WorldGame`, `Renderer`, sprites, cabeçalho e controles Canvas reais. A prancha principal contém 12 poses autoradas e **não** é um replay. Separadamente, o replay congelado do responsável pela mecânica percorre 1.523 frames de input, sem reposicionar Feka, fabricar dano ou concluir por atalho; chega ao fim em x657,325 com capacete. Sete capturas registram entrada, carga, descarga, refúgio, espera segura, segunda passagem e conclusão efetiva.

Saídas: `contact-sheet.png`, `touch-fallback.png`, capturas `normal-*`/`reduced-*`/`replay-*`, 85 frames de animação e `proof.json`. A verificação independente lê 2.764.800 pixels do Canvas nativo e exige igualdade entre cobertura ciano opaca e o perigo projetado. Os binários ficam fora do repositório. A ferramenta pode gerar imagens reais offline; não demonstra funcionamento em navegador, dispositivo, toque físico, rede ou taxa de quadros.
