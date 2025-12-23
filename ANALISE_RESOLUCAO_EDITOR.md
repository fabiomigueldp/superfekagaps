# Análise do Problema de Resolução do Editor

Você notou que ao alterar o zoom no editor, o visual (sprites e grid) ficou borrado ou "low res".
Aqui está a explicação técnica profunda do porquê isso está acontecendo:

### 1. O Gargalo do Buffer Offscreen (320x180)

O motor do jogo (`Renderer.ts`) foi desenhado para ser "Pixel Perfect" estilo 8-bits. Para garantir isso, ele usa uma técnica de "Buffer Offscreen":

1.  O jogo desenha tudo em um canvas pequeno de **320x180 pixels** (`offscreenCanvas`).
2.  No final do frame, esse canvas pequeno é esticado (upscaled) para preencher a tela inteira (ex: 1920x1080).

**O problema no Editor:**
Atualmente, o Editor também está desenhando dentro desse buffer minúsculo de 320x180.

*   **Zoom In (Aproximar):** Quando você dá zoom (ex: 2x), o editor tenta desenhar os tiles "maiores" dentro desse canvas pequeno. Mas o canvas só tem 180 linhas de altura. Se você der muito zoom, os detalhes se perdem porque não há pixels suficientes no buffer para representar as linhas finas ou detalhes curvos.
*   **Grid Borrado:** O grid é desenhado com `lineWidth` fracionado (ex: 0.5px) para tentar ficar fino. Mas num canvas de baixa resolução, desenhar "meio pixel" força o navegador a fazer "anti-aliasing" (borrão) para simular a linha fina. Isso cria o aspecto sujo/focado.

### 2. A Solução "Pro" (High DPI Editor)

Para o editor ser nítido e profissional, ele **NÃO** pode desenhar no buffer de jogo (320x180). Ele precisa desenhar diretamente na tela de alta resolução (o canvas principal).

**A Mudança Necessária (Arquitetura):**

1.  **Separar Pipelines:**
    *   **Modo Jogo:** Continua usando o buffer 320x180 para manter a estética retrô fiel.
    *   **Modo Editor:** Deve bypassar o buffer e desenhar diretamente no contexto de alta resolução (`renderer.ctx`).

2.  **Adaptação do Renderer:**
    *   Precisamos refatorar levemente o `Renderer` para que seus métodos de desenho (`drawTile`, etc.) aceitem um "Contexto de Destino" opcional.
    *   Assim, o Editor pode passar o contexto de alta resolução para essas funções.

3.  **Escala Dinâmica:**
    *   Ao desenhar em alta resolução, um tile de 16 pixels ficaria minúsculo numa tela 1080p.
    *   O Editor precisará aplicar uma transformação global de escala (ex: 3x ou 4x) *multiplicada* pelo zoom do usuário.

Isso garantirá que o Grid tenha sempre 1 pixel real de espessura (super nítido) e que os sprites possam ser visualizados com clareza máxima mesmo com zoom extremo.

---
**Status:** Análise concluída. O código não foi alterado conforme sua instrução.
Quando estiver pronto, posso implementar essa mudança de arquitetura para "High Res Editor".
