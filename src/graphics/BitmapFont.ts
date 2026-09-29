import { ART } from './palette';

// Original 5×7 glyphs. Accent marks occupy two additional rows above the cap height.
const GLYPHS: Record<string, string> = {
  A:'01110/10001/10001/11111/10001/10001/10001', B:'11110/10001/10001/11110/10001/10001/11110',
  C:'01111/10000/10000/10000/10000/10000/01111', D:'11110/10001/10001/10001/10001/10001/11110',
  E:'11111/10000/10000/11110/10000/10000/11111', F:'11111/10000/10000/11110/10000/10000/10000',
  G:'01111/10000/10000/10111/10001/10001/01111', H:'10001/10001/10001/11111/10001/10001/10001',
  I:'11111/00100/00100/00100/00100/00100/11111', J:'00111/00010/00010/00010/10010/10010/01100',
  K:'10001/10010/10100/11000/10100/10010/10001', L:'10000/10000/10000/10000/10000/10000/11111',
  M:'10001/11011/10101/10101/10001/10001/10001', N:'10001/11001/10101/10011/10001/10001/10001',
  O:'01110/10001/10001/10001/10001/10001/01110', P:'11110/10001/10001/11110/10000/10000/10000',
  Q:'01110/10001/10001/10001/10101/10010/01101', R:'11110/10001/10001/11110/10100/10010/10001',
  S:'01111/10000/10000/01110/00001/00001/11110', T:'11111/00100/00100/00100/00100/00100/00100',
  U:'10001/10001/10001/10001/10001/10001/01110', V:'10001/10001/10001/10001/10001/01010/00100',
  W:'10001/10001/10001/10101/10101/10101/01010', X:'10001/10001/01010/00100/01010/10001/10001',
  Y:'10001/10001/01010/00100/00100/00100/00100', Z:'11111/00001/00010/00100/01000/10000/11111',
  '0':'01110/10001/10011/10101/11001/10001/01110', '1':'00100/01100/00100/00100/00100/00100/01110',
  '2':'01110/10001/00001/00010/00100/01000/11111', '3':'11110/00001/00001/01110/00001/00001/11110',
  '4':'00010/00110/01010/10010/11111/00010/00010', '5':'11111/10000/10000/11110/00001/00001/11110',
  '6':'01110/10000/10000/11110/10001/10001/01110', '7':'11111/00001/00010/00100/01000/01000/01000',
  '8':'01110/10001/10001/01110/10001/10001/01110', '9':'01110/10001/10001/01111/00001/00001/01110',
  '.':'0/0/0/0/0/1/1', ',':'00/00/00/00/00/01/10', ':':'0/1/1/0/1/1/0',
  '!':'1/1/1/1/1/0/1', '?':'1110/0001/0001/0110/0100/0000/0100',
  '-':'000/000/000/111/000/000/000', '+':'00000/00100/00100/11111/00100/00100/00000',
  '/':'00001/00010/00010/00100/01000/01000/10000', '×':'00000/10001/01010/00100/01010/10001/00000',
  '(':'001/010/100/100/100/010/001', ')':'100/010/001/001/001/010/100',
  '"':'101/101/000/000/000/000/000', "'":'1/1/0/0/0/0/0',
  '←':'00000/00100/01000/11111/01000/00100/00000', '→':'00000/00100/00010/11111/00010/00100/00000',
  '↓':'00000/00100/00100/10101/01110/00100/00000', '↑':'00000/00100/01110/10101/00100/00100/00000',
  '·':'0/0/0/1/0/0/0', '%':'11001/11010/00100/01000/10110/00110/00000',
  '°':'010/101/010/000/000/000/000',
  '★':'00100/00100/11111/01110/01010/10001/00000',
  '♥':'01010/11111/11111/11111/01110/00100/00000',
};
const rows = new Map(Object.entries(GLYPHS).map(([key, value]) => [key, value.split('/')]));
const advance = (c: string) => c === ' ' ? 4 : (rows.get(c.normalize('NFD')[0])?.[0].length ?? 5) + 1;
export function textWidth(value: string, scale = 1): number {
  const chars = [...value.toLocaleUpperCase('pt-BR')];
  return Math.max(0, chars.reduce((sum, c) => sum + advance(c), 0) - 1) * scale;
}
export function fitText(value: string, width: number, scale = 1): string {
  if (textWidth(value, scale) <= width) return value;
  let out = value;
  while (out && textWidth(out + '...', scale) > width) out = out.slice(0, -1);
  return out + '...';
}
export function wrapText(value: string, width: number): string[] {
  const lines: string[] = []; let line = '';
  for (const word of value.split(/\s+/)) {
    if (line && textWidth(line + ' ' + word) > width) { lines.push(line); line = ''; }
    for (const c of (line ? ' ' : '') + word) {
      if (textWidth(line + c) > width) { lines.push(line); line = ''; }
      line += c;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function pixelText(ctx: CanvasRenderingContext2D, value: string, x: number, y: number,
  color: string = ART.paper, scale = 1, align: 'left' | 'center' | 'right' = 'left'): void {
  x = Math.round(x - (align === 'center' ? textWidth(value, scale) / 2 : align === 'right' ? textWidth(value, scale) : 0));
  y = Math.round(y); ctx.fillStyle = color;
  for (const c of value.toLocaleUpperCase('pt-BR')) {
    if (c !== ' ') {
      const [base, mark] = c.normalize('NFD');
      const glyph = rows.get(base) ?? rows.get('?')!;
      glyph.forEach((row, yy) => [...row].forEach((v, xx) => { if (v === '1') ctx.fillRect(x + xx * scale, y + yy * scale, scale, scale); }));
      const dot = (xx: number, yy: number) => ctx.fillRect(x + xx * scale, y + yy * scale, scale, scale);
      if (mark === '\u0301') { dot(3,-2); dot(2,-1); }
      if (mark === '\u0300') { dot(1,-2); dot(2,-1); }
      if (mark === '\u0302') { dot(2,-2); dot(1,-1); dot(3,-1); }
      if (mark === '\u0303') { dot(1,-2); dot(2,-2); dot(3,-1); dot(4,-2); }
      if (mark === '\u0327') { dot(2,7); dot(1,8); }
    }
    x += advance(c) * scale;
  }
}

export function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  fill: string = ART.ink, edge: string = ART.rockLight): void {
  ctx.fillStyle = ART.ink; ctx.fillRect(x + 2, y + 2, w, h);
  ctx.fillStyle = edge; ctx.fillRect(x + 1, y, w - 2, h); ctx.fillRect(x, y + 1, w, h - 2);
  ctx.fillStyle = fill; ctx.fillRect(x + 1, y + 2, w - 2, h - 4); ctx.fillRect(x + 2, y + 1, w - 4, h - 2);
}
