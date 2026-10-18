import replay from './hypotheticalReplay.json';

/** Both routes begin at the native spawn; only the third jump's timing differs. */
export function hypotheticalChaseInputs(route: 'upper' | 'lower'): [number, string[]][] {
    return (replay.runs.slice(0, 11) as [number, string[]][]).flatMap((run, i): [number, string[]][] =>
        route === 'lower' && i === 5 ? [
            [9, ['ArrowRight', 'ShiftLeft']],
            [6, ['ArrowRight', 'ShiftLeft', 'Space']],
            [3, ['ArrowRight', 'ShiftLeft']],
        ] : [run]);
}
