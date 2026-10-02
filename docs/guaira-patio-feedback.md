# Pátio das Comportas · leitura da máquina

A apresentação distingue o tabuleiro que sustenta Feka do piso seco. A mensagem de recuperação exige apoio nativo em um tile do trecho inferior e não aparece em um salto, na doca ou durante o transporte em A/B. Um apoio parcial na borda do tabuleiro conta como na colisão nativa. No tabuleiro, o texto informa sua letra, subida/descida ou posição assentada, e o abastecimento atual.

As duas placas mantêm a gravação fixa `A/B`. O banner existente prioriza os 400 ms de `DESVIO PARA …`, depois o movimento real dos tabuleiros. Perto das placas e com a máquina estável, informa o próximo pedido: `PULE + BAIXO: AGUA PARA A` ou `B`. Assim, no frame 500, a ação bem-sucedida continua mostrando `B SOBE / A DESCE`, sem sugerir reversão enquanto B sobe. O cabeçalho e a válvula mostram o abastecimento real até a troca efetiva. Os textos de orientação em repouso também acompanham a próxima troca, inclusive após reversões.

O trabalhador da entrada observa A. O trabalhador do patamar central e o do arrozal observam B. O aviso usa a pose existente de atenção inicial; o deslocamento em qualquer direção usa o progresso real até o destino nativo; um tabuleiro alto usa a pose relaxada e a doca seca permite retomar o trabalho. Não há poses, adereços, partículas, painéis, relógios ou estado de animação novos. Pausa e movimento reduzido continuam usando o mesmo tempo e os mesmos estados de simulação.

## Verificação focada

```sh
node --import tsx --test tests/guaira-junction-feedback.test.ts tests/guaira-junction.test.ts
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
```

Os 19 testes passaram: cinco verificam a correção visual e os 14 existentes preservam sentada, reversões, transporte, recuperação natural por piso/degrau, pausa/blur/aba oculta, retry, retorno seguro, toque, movimento reduzido e pureza do render.

Após a revisão da prioridade do banner, apenas a regressão `banner prioritizes` foi repetida e passou, incluindo o frame 500 do replay nativo. Só o PNG desse frame e seu par na comparação foram atualizados; os 501 estados até ele continuaram idênticos.

O replay nativo de 893 frames foi rasterizado antes e depois contra a base `c27019374479da44defb57f038d1597b9fd3e549`. A transporta Feka por 119 frames e B por 152. Todos os estados físicos e de câmera dos 894 pontos, incluindo o inicial, são idênticos. O hash SHA-256 conjunto de jogador, objetos, roteamento, tempos, conclusão e checkpoint é `18d6e844dd4a497febf5763dfc9ccd887eae9e719e80f2ed3ad976c4233562fe` em ambos.

Antes, os frames 153–182 sobre A e 546–556 sobre B diziam “Piso seco de recuperação”. Depois, os 41 frames identificam o tabuleiro em subida. No frame 180, os pés continuam em `338.58333333333206`; apenas a orientação muda. O mesmo vale para o frame 552 sobre B, com pés em `340.41666666666544`.

A evidência local fica em `/tmp/guaira-junction-proof/feedback-before` e `feedback-after`, com 13 PNGs dos mesmos frames, `proof.json` e todos os estados em `frames.json`. `feedback-comparison.json` registra as diferenças de texto e `feedback-comparison.png` põe seis pares lado a lado. As legendas da comparação reproduzem separadamente o texto DOM, que não faz parte da imagem Canvas. O gerador local é `feedback-proof.mts`, na mesma pasta pai, e aceita o caminho do checkout e da pasta de saída.

São provas offline com a engine e o pintor Canvas reais; DOM e áudio são simulados. Não houve navegador, QA em aparelho, publicação nem acesso a Oracle. Nenhum asset ou dependência de runtime foi adicionado; os artefatos visuais ficam fora do pacote. A checagem agregada e a medição final do orçamento de 45 MB pertencem à integração.
