/** Cosmetic block responses. They never move a collider or delay tile removal. */
export interface BlockImpact {
    col: number;
    row: number;
    kind: 'bump' | 'break';
    direction: 'up' | 'down';
    age: number;
}
export const BLOCK_BUMP_MS = 180;
export const BLOCK_BREAK_MS = 520;
export const MAX_BLOCK_IMPACTS = 24;

export class BlockImpacts {
    readonly active: BlockImpact[] = [];

    add(col: number, row: number, kind: BlockImpact['kind'], direction: BlockImpact['direction'] = 'up'): void {
        // A second hit replaces the old response rather than stacking or leaving a ghost block.
        const previous = this.active.findIndex(p => p.col === col && p.row === row);
        if (previous >= 0) this.active.splice(previous, 1);
        if (this.active.length === MAX_BLOCK_IMPACTS) this.active.shift();
        this.active.push({ col, row, kind, direction, age: 0 });
    }

    update(deltaMs: number): void {
        if (!this.active.length || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
        // Compact in place; an idle level does no allocations or animation work.
        let keep = 0;
        for (const impact of this.active) {
            impact.age += deltaMs;
            if (impact.age < (impact.kind === 'bump' ? BLOCK_BUMP_MS : BLOCK_BREAK_MS)) this.active[keep++] = impact;
        }
        this.active.length = keep;
    }

    offset(col: number, row: number, reducedMotion = false): number {
        if (reducedMotion || !this.active.length) return 0;
        const impact = this.active.find(p => p.kind === 'bump' && p.col === col && p.row === row);
        if (!impact) return 0;
        const t = impact.age;
        // Fast compression, heavier return, then a single 1 px settling beat.
        return Math.round(t < 35 ? -1 - 2 * t / 35 : t < 115 ? -3 + 4 * (t - 35) / 80 : Math.max(0, 1 - (t - 115) / 65));
    }

    clear(): void { this.active.length = 0; }
}
