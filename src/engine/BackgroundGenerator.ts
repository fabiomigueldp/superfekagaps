import { BackgroundLayerSpec } from '../types';

export class BackgroundGenerator {
    /**
     * Gera um canvas offscreen contendo a arte da camada de fundo.
     * A largura (width) deve ser suficiente para cobrir a tela (ex: GAME_WIDTH).
     * O renderizador desenhará essa imagem repetida (tiled) horizontalmente.
     */
    static generateLayer(spec: BackgroundLayerSpec, width: number, height: number, scale: number = 1): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(width * scale);
        canvas.height = Math.ceil(height * scale);
        const ctx = canvas.getContext('2d')!;

        // Scale context to draw at high resolution using logical coordinates
        ctx.scale(scale, scale);

        // Opcional: Para visual "cartoon/vetor" suave, mantemos smoothing padrao (true).
        // Se quiséssemos pixel art estrito ampliado, desligaríamos.
        // Como o objetivo é "High Res", deixamos suave para curvas perfeitas.
        // ctx.imageSmoothingEnabled = false; 

        switch (spec.type) {
            case 'clouds':
                this.drawClouds(ctx, width, height, spec);
                break;
            case 'mountains':
                this.drawMountains(ctx, width, height, spec);
                break;
            case 'hills':
                this.drawHills(ctx, width, height, spec);
                break;
            case 'city':
                this.drawCity(ctx, width, height, spec);
                break;
            case 'castle_wall':
                this.drawCastleWall(ctx, width, height, spec);
                break;
        }

        return canvas;
    }

    private static drawClouds(ctx: CanvasRenderingContext2D, width: number, height: number, spec: BackgroundLayerSpec): void {
        ctx.fillStyle = spec.color;
        // Nuvens esparsas
        const numClouds = 5;
        const avgY = spec.baseHeight || height * 0.2;

        for (let i = 0; i < numClouds; i++) {
            // Espalhamento uniforme horizontalmente
            const cx = (width / numClouds) * i + (Math.random() * 40 - 20);
            const cy = avgY + (Math.random() * 30 - 15);
            const size = 15 + Math.random() * 10;

            ctx.beginPath();
            // Desenha nuvem composta por 3-5 círculos
            const parts = 3 + Math.floor(Math.random() * 3);
            for (let p = 0; p < parts; p++) {
                const ox = (Math.random() - 0.5) * size * 1.5;
                const oy = (Math.random() - 0.5) * size * 0.5;
                const r = size * (0.6 + Math.random() * 0.4);
                ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);

                // Wrap around para seamless (desenha também na outra borda se estiver perto)
                if (cx + ox + r > width) {
                    ctx.arc(cx + ox - width, cy + oy, r, 0, Math.PI * 2);
                } else if (cx + ox - r < 0) {
                    ctx.arc(cx + ox + width, cy + oy, r, 0, Math.PI * 2);
                }
            }
            ctx.fill();
        }
    }

    private static drawMountains(ctx: CanvasRenderingContext2D, width: number, height: number, spec: BackgroundLayerSpec): void {
        ctx.fillStyle = spec.color;

        const baseH = spec.baseHeight || height * 0.6;
        const roughness = spec.roughness || 15;

        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, baseH);

        const steps = 20; // Pontos de controle
        const stepWidth = width / steps;

        // Para garantir seamless, o último ponto deve alinhar com o primeiro (y = baseH)
        // Vamos gerar deslocamentos aleatórios, mas forçar o fim.

        let currentY = baseH;
        for (let i = 1; i <= steps; i++) {
            const x = i * stepWidth;
            // Interpolação para voltar ao início no final
            const progress = i / steps;

            // Random walk
            let targetY = currentY + (Math.random() - 0.5) * roughness * 2;

            // Bias para voltar a baseH perto do fim
            if (i > steps - 5) {
                targetY = targetY * (1 - progress) + baseH * progress;
            }

            // Garante que o último ponto É baseH
            if (i === steps) targetY = baseH;

            ctx.lineTo(x, targetY);
            currentY = targetY;
        }

        ctx.lineTo(width, height);
        ctx.fill();
    }

    private static drawHills(ctx: CanvasRenderingContext2D, width: number, height: number, spec: BackgroundLayerSpec): void {
        ctx.fillStyle = spec.color;
        const baseH = spec.baseHeight || height * 0.7;

        ctx.beginPath();
        ctx.moveTo(0, height);

        // Curva suave usando seno
        // frequency ajustada para garantir loop perfeito (múltiplo de PI * 2)
        // Width corresponde a 2 periodos, por exemplo.
        const frequency = (Math.PI * 2) / width;
        // Vamos usar 2 'lombadas' grandes
        const waves = 1.5;

        for (let x = 0; x <= width; x += 5) {
            // Combinação de senos para irregularidade suave
            const y1 = Math.sin(x * frequency * waves) * 20;
            const y2 = Math.sin(x * frequency * waves * 2.5) * 10;

            const y = baseH - (Math.abs(y1) + y2);
            ctx.lineTo(x, y);
        }

        ctx.lineTo(width, height);
        ctx.fill();
    }

    private static drawCity(ctx: CanvasRenderingContext2D, width: number, height: number, spec: BackgroundLayerSpec): void {
        ctx.fillStyle = spec.color;
        const baseH = spec.baseHeight || height * 0.8;

        const buildingWidth = 20;
        const numBuildings = Math.ceil(width / buildingWidth);

        // Seeded random-ish para consistência visual se precisasse recriar, mas aqui é random
        for (let i = 0; i < numBuildings; i++) {
            const h = 20 + Math.random() * 40;
            const x = i * buildingWidth;
            const y = baseH - h;

            ctx.fillRect(x, y, buildingWidth + 1, h + (height - baseH));

            // Janelas (detalhe simples)
            ctx.fillStyle = 'rgba(255, 255, 200, 0.3)'; // Luzes
            for (let wx = x + 4; wx < x + buildingWidth - 4; wx += 4) {
                for (let wy = y + 4; wy < baseH - 4; wy += 6) {
                    if (Math.random() > 0.3) {
                        ctx.fillRect(wx, wy, 2, 4);
                    }
                }
            }
            // Volta cor original
            ctx.fillStyle = spec.color;
        }
    }

    private static drawCastleWall(ctx: CanvasRenderingContext2D, width: number, height: number, spec: BackgroundLayerSpec): void {
        ctx.fillStyle = spec.color;
        const baseH = spec.baseHeight || height * 0.5; // Parede alta

        // Fundo solido da parede para baixo
        ctx.fillRect(0, baseH, width, height - baseH);

        // Torres / Pilares
        const pillarDist = 60;
        const numPillars = Math.ceil(width / pillarDist);

        for (let i = 0; i < numPillars; i++) {
            const x = i * pillarDist;
            // Pilar sobe um pouco mais
            ctx.fillRect(x, baseH - 40, 20, 40);

            // Topo do pilar (crenellations)
            ctx.fillRect(x - 2, baseH - 45, 24, 5);
        }

        // Detalhes de tijolos na parede
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        for (let y = baseH; y < height; y += 10) {
            const offsetX = (Math.floor(y / 10) % 2) * 10;
            for (let x = -10; x < width; x += 20) {
                ctx.fillRect(x + offsetX, y, 2, 10);
                ctx.fillRect(x + offsetX, y + 9, 20, 1);
            }
        }
    }
}
