/** Fixed atlas footprint: 2.6× the released island canvases, never camera-scaled. */
export const DELICIA_ATLAS = Object.freeze({ left: -2.70, top: -3.02, widthInMap: 2.60, heightInMap: 2.60 });
/** Keep every expansion asset in the same release as its entry page. */
export function deliciaAsset(file: string, base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'): string {
    return `${base.endsWith('/') ? base : `${base}/`}assets/delicia/${file}`;
}
export const DELICIA_MAP_IMAGE = deliciaAsset('island.webp?v=4');
export const DELICIA_MAP_METADATA = deliciaAsset('island-map.json?v=4');
export const DELICIA_ENTRY = './delicia.html';
