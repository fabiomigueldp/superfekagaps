// Utilitários de Assets (animações, frames, carregamento de imagens)

export type SpriteAnimationSpec = {
  frames: number[]; // indices relativos ou ids
  frameDuration?: number; // ms por frame
};

export type SpriteSpec = {
  url?: string;
  animations?: Record<string, SpriteAnimationSpec>;
};

// cache simples de imagens
const imageCache: Record<string, HTMLImageElement> = {};

export function loadImage(url: string): Promise<HTMLImageElement> {
  if (imageCache[url]) return Promise.resolve(imageCache[url]);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache[url] = img;
      resolve(img);
    };
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

/**
 * resolveFrame: dado um sprite spec e um frame id (ou índice), retorna um objeto com
 * geometria do frame: { x,y,w,h, pivot?, sourceSize?, spriteSourceSize? }
 * - Se o spec tiver uma lista detalhada de frames, usa-a.
 * - Caso contrário, tenta inferir a grade a partir do tamanho da imagem (se fornecida)
 *   ou retorna uma caixa padrão baseada em dimensões típicas.
 */
export function resolveFrame(spec: SpriteSpec | undefined, frameId: number, image?: HTMLImageElement) {
  // Se spec tiver frames detalhados (array de objetos), use diretamente
  // formato esperado: spec.frames = [{ x,y,w,h, pivot?, sourceSize?, spriteSourceSize? }, ...]
  const defaultW = 16;
  const defaultH = 24;

  // Caso 1: spec.frames como array de objetos
  // (compatibilidade com atlas JSON gerados por ferramentas)
  // @ts-ignore - spec may be loose
  if (spec && (spec as any).frames && Array.isArray((spec as any).frames)) {
    const arr = (spec as any).frames;
    const f = arr[frameId % arr.length];
    if (typeof f === 'object') return f;
  }

  // Caso 2: inferir pela imagem (grade)
  if (image && image.width && image.height) {
    const cols = Math.max(1, Math.floor(image.width / defaultW));
    const x = (frameId % cols) * defaultW;
    const y = Math.floor(frameId / cols) * defaultH;
    return { x, y, w: defaultW, h: defaultH, pivot: { x: 0.5, y: 1.0 } };
  }

  // Fallback simples
  return { x: 0, y: 0, w: defaultW, h: defaultH, pivot: { x: 0.5, y: 1.0 } };
}

// getAnimFrame: OVERLOADS
// 1) (animationTimer: number, frameCount: number, frameDurationMs?: number)
// 2) (spec: SpriteSpec, animName: string, animationTimer: number) -> returns frame index (number)
export function getAnimFrame(animationTimer: number, frameCount: number, frameDurationMs?: number): number;
export function getAnimFrame(spec: SpriteSpec, animName: string, animationTimer: number): number;
export function getAnimFrame(a: any, b: any, c?: any): any {
  // case 1
  if (typeof a === 'number' && typeof b === 'number') {
    const animationTimer: number = a;
    const frameCount: number = b;
    const frameDurationMs: number = typeof c === 'number' ? c : 150;
    if (frameCount <= 0) return 0;
    return Math.floor(animationTimer / frameDurationMs) % frameCount;
  }

  // case 2: (spec, animName, animationTimer) -> return numeric frame id / index
  const spec: SpriteSpec = a;
  const animName: string = b;
  const animationTimer: number = c as number;
  const anim = spec?.animations?.[animName];
  if (!anim) return 0;
  const frameCount = anim.frames?.length ?? 1;
  const frameDuration = anim.frameDuration ?? 150;
  const idx = Math.floor(animationTimer / frameDuration) % frameCount;
  // Se anim.frames é um array de numbers, devolve o id correspondente
  if (Array.isArray(anim.frames) && typeof anim.frames[0] === 'number') {
    return anim.frames[idx];
  }
  // Caso anim.frames não seja array de numbers, devolve o índice
  return idx;
}

export default {
  getAnimFrame,
  resolveFrame,
  loadImage
};