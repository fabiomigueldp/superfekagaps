/** Optional, attempt-local goals. Never a chapter receipt, save field or unlock. */
export type GuairaReliefGoal = 'open-relief' | 'keep-lid-and-helmet';
export interface GuairaReliefOptions { readonly routeGoal?: GuairaReliefGoal | null; }
export type GuairaReliefReplayKind = 'other-route' | 'retry';

export const RELIEF_ROUTE_OBJECTIVES: Readonly<Record<GuairaReliefGoal, string>> = Object.freeze({
    'open-relief': 'Explore a manutenção, abra a tampa de alívio e alcance a saída.',
    'keep-lid-and-helmet': 'Atravesse mantendo a tampa e o capacete intactos, sem morrer nesta tentativa.'
});

export interface GuairaReliefChallengeSnapshot {
    readonly goal: GuairaReliefGoal | null;
    readonly objective: string | null;
    readonly verdict: 'unselected' | 'in-progress' | 'missed' | 'met';
    readonly evidence: Readonly<{
        lidOpened: boolean;
        helmetLost: boolean;
        died: boolean;
        reconstructed: boolean;
        arrived: boolean;
        reliefOpenAtArrival: boolean;
    }>;
}

export interface GuairaReliefReplayAction {
    readonly kind: GuairaReliefReplayKind;
    readonly options: Readonly<GuairaReliefOptions>;
    readonly objective: string | null;
    /** Call once at activation, after the host's owner/focus/press guards.
     * On success retire the old host token, dispose the runtime, then mount a
     * fresh relief factory with these options. Never save/serialize the action.
     * This only grants replay options; it does not load a scene or clear input. */
    consume(): Readonly<GuairaReliefOptions> | null;
}

export interface GuairaReliefRouteAPI {
    /** Rebind displayed actions when this changes; keep the host's own
     * pointer/key press lease so a press before OUTRA ROTA appears stays old. */
    readonly revision: number;
    readonly snapshot: GuairaReliefChallengeSnapshot;
    capture(kind: GuairaReliefReplayKind): GuairaReliefReplayAction | null;
}

/** Private to the native adapter. The host receives only immutable observations
 * and replay actions, never these mutators. No clock, DOM, input or storage. */
export class GuairaReliefChallenge {
    private evidence = this.emptyEvidence();
    constructor(readonly goal: GuairaReliefGoal | null = null) {
        if (goal !== null && goal !== 'open-relief' && goal !== 'keep-lid-and-helmet')
            throw Error('Unknown optional Relief route goal');
    }
    private emptyEvidence() {
        return { lidOpened: false, helmetLost: false, died: false, reconstructed: false,
            arrived: false, reliefOpenAtArrival: false };
    }
    reset(): void { this.evidence = this.emptyEvidence(); }
    reconstruct(): void {
        // A restored checkpoint can give the helmet back and reseal the lid.
        // It must not erase the path already taken in this optional attempt.
        this.evidence.reconstructed = true;
        this.evidence.arrived = false;
        this.evidence.reliefOpenAtArrival = false;
    }
    observe(sample: { alive: boolean; hasHelmet: boolean; reliefOpened: boolean; finished: boolean }): void {
        if (this.evidence.arrived) return;
        this.evidence.helmetLost ||= !sample.hasHelmet;
        this.evidence.died ||= !sample.alive;
        this.evidence.lidOpened ||= sample.reliefOpened;
        if (sample.finished && sample.alive) {
            this.evidence.arrived = true;
            this.evidence.reliefOpenAtArrival = sample.reliefOpened;
        }
    }
    snapshot(): GuairaReliefChallengeSnapshot {
        const e = this.evidence;
        const missed = this.goal === 'keep-lid-and-helmet'
            && (e.lidOpened || e.helmetLost || e.died || e.reconstructed);
        const met = e.arrived && (this.goal === 'open-relief'
            ? e.lidOpened && e.reliefOpenAtArrival : !missed);
        const verdict = this.goal === null ? 'unselected' : met ? 'met'
            : missed || e.arrived ? 'missed' : 'in-progress';
        return Object.freeze({ goal: this.goal, objective: this.goal === null ? null : RELIEF_ROUTE_OBJECTIVES[this.goal],
            verdict, evidence: Object.freeze({ ...e }) });
    }
}

/** Read-only copy for native status or host completion text. A missed optional
 * goal never invalidates PASSAGEM INSPECIONADA or claims a perfect crossing. */
export function reliefChallengeMessage(snapshot: GuairaReliefChallengeSnapshot): string | null {
    if (snapshot.goal === null) return null;
    if (snapshot.verdict === 'met') return snapshot.goal === 'open-relief'
        ? 'Objetivo opcional cumprido: alívio aberto e saída alcançada.'
        : 'Objetivo opcional cumprido: tampa e capacete conservados nesta tentativa.';
    if (snapshot.verdict === 'missed') return snapshot.evidence.arrived
        ? 'Passagem concluída; objetivo opcional não cumprido. Tentar repete o desafio.'
        : 'Objetivo opcional não cumprido nesta tentativa; você pode seguir até a saída ou tentar novamente.';
    return `Opcional: ${snapshot.objective}`;
}
