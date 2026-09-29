/** Production palette. Shared by actors, materials, effects and bitmap UI. */
export const ART = {
  ink: '#191f35', inkLight: '#303650', hair: '#292c40', hairLight: '#48435c',
  paper: '#f5efd3', white: '#fff9e6', muted: '#a7b4bb',
  skinDark: '#8b4d3f', skin: '#c58359', skinLight: '#efb87b',
  blueDark: '#253c73', blue: '#3e73bb', blueLight: '#81b7dd',
  soilDark: '#523748', soil: '#92604c', soilLight: '#bc845d', soilTop: '#dea872',
  leafDark: '#28544b', leaf: '#4c8660', leafLight: '#89b76b', leafTip: '#c4d98b',
  rockDark: '#203547', rock: '#36566a', rockLight: '#648591', rockTop: '#a6c4bd',
  redDark: '#803747', red: '#ca5357', redLight: '#f28b6b',
  goldDark: '#a9663d', gold: '#e9ad4c', goldLight: '#ffe29a',
  orangeDark: '#aa4a35', orange: '#ec853e', orangeLight: '#ffc778',
  tealDark: '#286279', teal: '#4eafa7', tealLight: '#9ce3cf',
  purpleDark: '#4e365f', purple: '#855186', purpleLight: '#c38caf',
  greenDark: '#527553', green: '#86ad71', greenLight: '#bfd397',
  iceDark: '#477f99', ice: '#8fc5ce', iceLight: '#d5eee2',
} as const;

export type Biome = 'meadow' | 'ember' | 'citadel';
export const BIOMES: readonly Biome[] = ['meadow', 'ember', 'citadel'];

/** Stable positive hash: texture variants do not change when a palette is edited. */
export function hashAt(x: number, y: number, seed = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export function mixColor(a: string, b: string, amount: number): string {
  const parse = (value: string): number[] => {
    const hex = /^#([a-f\d]{6})$/i.exec(value);
    if (hex) return [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16));
    const rgb = value.match(/[\d.]+/g);
    return rgb && rgb.length >= 3 ? rgb.slice(0, 3).map(Number) : [54, 86, 106];
  };
  const aa = parse(a), bb = parse(b), t = Math.max(0, Math.min(1, amount));
  return '#' + aa.map((v, i) => Math.round(v + (bb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
