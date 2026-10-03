import { sanitizeGuairaChapterProgress, type GuairaChapterProgress } from './GuairaChapterProgress';
/** The chapter owns only receipts and navigation, never native scene/save state. */
export type GuairaChapterOpening = 'guaira-travessia' | 'guaira-patio-comportas';
export type GuairaChapterSceneId = GuairaChapterOpening | 'guaira-respiros' | 'guaira-lab'
    | 'guaira-subida' | 'guaira-prefeito';
export type GuairaChapterTraversalId = GuairaChapterOpening | 'guaira-respiros' | 'guaira-subida';

export interface GuairaChapterOptions {
    readonly opening?: GuairaChapterOpening;
    readonly progress?: GuairaChapterProgress;
}

/** Capture this when installing map/restart callbacks; never look it up in an old callback. */
export interface GuairaChapterGeneration {
    readonly sessionId: number;
    readonly generation: number;
}

/** Capture this when mounting a scene, and replace it synchronously on native retry. */
export interface GuairaChapterAttempt extends GuairaChapterGeneration {
    readonly attemptGeneration: number;
    readonly sceneId: GuairaChapterSceneId;
}

export type GuairaChapterResult =
    | Readonly<{ sceneId: GuairaChapterTraversalId; kind: 'reached-finish' }>
    | Readonly<{ sceneId: 'guaira-lab'; kind: 'defeated-bull' }>
    | Readonly<{ sceneId: 'guaira-prefeito'; kind: 'mayor-water-released' }>;

/**
 * Supplied by the mounted scene adapter, sampled again at the explicit action.
 * `result` is null until that scene's real completion predicate holds. Neither a
 * checkpoint, URL, map location nor a readiness sample is completion evidence.
 * `state` accepts the host's native screen type without importing campaign types.
 */
export interface GuairaChapterLiveResult {
    readonly attempt: GuairaChapterAttempt;
    readonly state: string;
    readonly alive: boolean;
    readonly result: GuairaChapterResult | null;
}

export interface GuairaChapterReceipt {
    readonly sceneId: GuairaChapterSceneId;
    readonly attempt: GuairaChapterAttempt;
    readonly result: GuairaChapterResult;
    readonly acceptedVia: 'continue' | 'map' | 'runtime' | 'restored';
}

export interface GuairaChapterSnapshot {
    readonly generation: GuairaChapterGeneration;
    readonly opening: GuairaChapterOpening;
    readonly route: readonly GuairaChapterSceneId[];
    readonly accepted: readonly GuairaChapterReceipt[];
    readonly selectedScene: GuairaChapterSceneId;
    readonly activeAttempt: GuairaChapterAttempt | null;
    readonly nextRecommendedScene: GuairaChapterSceneId | null;
    readonly chapterComplete: boolean;
    readonly disposed: boolean;
}

export interface GuairaChapterTransition {
    readonly action: 'continue' | 'map';
    /** Null means map exit abandoned an unfinished/dead attempt. */
    readonly receipt: GuairaChapterReceipt | null;
    /** A replay returns its original receipt without replacing chapter history. */
    readonly newlyAccepted: boolean;
    readonly snapshot: GuairaChapterSnapshot;
}

// Process-local identity only: no clock, random source, persistence or URL input.
let nextSessionId = 1;

/**
 * Five-scene journey with durable receipt hydration and process-local attempt leases. Mutation methods reject stale handles with
 * null, without changing state. A successful transition retires its attempt
 * before returning; the host then disposes the old runtime and mounts its next
 * map/scene. This model never mounts, resumes or resets native gameplay itself.
 */
export class GuairaChapterSession {
    private readonly sessionId = nextSessionId++;
    private generationNumber = 0;
    private attemptNumber = 0;
    private currentGeneration: GuairaChapterGeneration;
    private activeAttempt: GuairaChapterAttempt | null = null;
    private readonly accepted = new Map<GuairaChapterSceneId, GuairaChapterReceipt>();
    private closed = false;
    private readonly opening: GuairaChapterOpening;
    private readonly route: readonly GuairaChapterSceneId[];
    private selectedScene: GuairaChapterSceneId;

    constructor({ opening = 'guaira-travessia', progress }: GuairaChapterOptions = {}) {
        const restored = progress ? sanitizeGuairaChapterProgress(progress) : null;
        if (restored) opening = restored.opening;
        if (opening !== 'guaira-travessia' && opening !== 'guaira-patio-comportas')
            throw new Error('Unknown Guaíra chapter opening');
        this.opening = opening;
        this.selectedScene = opening;
        this.route = Object.freeze([opening, 'guaira-respiros', 'guaira-lab', 'guaira-subida', 'guaira-prefeito']);
        this.currentGeneration = this.makeGeneration();
        if (restored) {
            for (const sceneId of restored.completed) {
                const result: GuairaChapterResult = sceneId === 'guaira-lab' ? { sceneId, kind: 'defeated-bull' }
                    : sceneId === 'guaira-prefeito' ? { sceneId, kind: 'mayor-water-released' } : { sceneId, kind: 'reached-finish' };
                this.accepted.set(sceneId, Object.freeze({ sceneId, result: Object.freeze(result), acceptedVia: 'restored',
                    attempt: Object.freeze({ ...this.currentGeneration, sceneId, attemptGeneration: 0 }) }));
            }
            this.selectedScene = restored.selectedScene;
        }
    }

    snapshot(): GuairaChapterSnapshot {
        const nextRecommendedScene = this.nextRecommendedScene();
        return Object.freeze({
            generation: this.currentGeneration, opening: this.opening, route: this.route,
            accepted: Object.freeze(this.route.flatMap(scene => {
                const receipt = this.accepted.get(scene);
                return receipt ? [receipt] : [];
            })),
            selectedScene: this.selectedScene, activeAttempt: this.activeAttempt, nextRecommendedScene,
            chapterComplete: nextRecommendedScene === null, disposed: this.closed
        });
    }

    /** Map selection is separate from physical arrival and never mounts a scene. */
    canSelectScene(sceneId: GuairaChapterSceneId, from: GuairaChapterGeneration): boolean {
        return this.isCurrentGeneration(from) && this.activeAttempt === null
            && this.route.includes(sceneId)
            && (sceneId === this.nextRecommendedScene() || this.accepted.has(sceneId));
    }

    /** Even reselecting retires existing contextual buttons before returning. */
    selectScene(sceneId: GuairaChapterSceneId, from: GuairaChapterGeneration): GuairaChapterSnapshot | null {
        if (!this.canSelectScene(sceneId, from)) return null;
        this.selectedScene = sceneId;
        this.advanceGeneration();
        return this.snapshot();
    }

    /** The host must additionally require physical map arrival at the selected scene. */
    canEnterScene(sceneId: GuairaChapterSceneId, from: GuairaChapterGeneration): boolean {
        return this.canSelectScene(sceneId, from) && sceneId === this.selectedScene;
    }

    /** A successful entry requires the host to load the selected scene from its native start. */
    enterScene(sceneId: GuairaChapterSceneId, from: GuairaChapterGeneration): GuairaChapterAttempt | null {
        if (!this.canEnterScene(sceneId, from)) return null;
        return this.beginAttempt(sceneId);
    }

    /** Call before the native reset, including a recovery that recreates the scene. */
    retry(attempt: GuairaChapterAttempt): GuairaChapterAttempt | null {
        if (!this.isCurrentAttempt(attempt)) return null;
        return this.beginAttempt(attempt.sceneId);
    }

    /** Readiness is not latched: acceptance always needs a fresh live sample. */
    canContinue(attempt: GuairaChapterAttempt, live: GuairaChapterLiveResult): boolean {
        return live.state === 'playing' && this.hasLiveCompletion(attempt, live);
    }

    /** Latch actual runtime victory immediately, without retiring the live attempt. */
    acceptCompletion(attempt: GuairaChapterAttempt, live: GuairaChapterLiveResult): boolean {
        if (!this.hasLiveCompletion(attempt, live) || this.accepted.has(attempt.sceneId)) return false;
        this.accepted.set(attempt.sceneId, Object.freeze({ sceneId: attempt.sceneId, attempt,
            result: Object.freeze({ ...live.result! }), acceptedVia: 'runtime' }));
        return true;
    }

    /** Returns to the host with the next recommendation; does not auto-enter it. */
    continueFrom(attempt: GuairaChapterAttempt, live: GuairaChapterLiveResult): GuairaChapterTransition | null {
        if (!this.canContinue(attempt, live)) return null;
        return this.transition('continue', attempt, live.result!);
    }

    /**
     * A live completed attempt is accepted, including while paused; otherwise it
     * is abandoned. Death never awards a receipt, even with a finish flag.
     * No helmet, checkpoint, elapsed time or machine state crosses this boundary.
     */
    exitToMap(attempt: GuairaChapterAttempt, live: GuairaChapterLiveResult): GuairaChapterTransition | null {
        if (!this.isCurrentAttempt(attempt) || !this.matchesAttempt(live.attempt, attempt)) return null;
        return this.transition('map', attempt, this.hasLiveCompletion(attempt, live) ? live.result : null);
    }

    /** Explicit chapter restart closes this model and creates a new empty session. */
    restartChapter(from: GuairaChapterGeneration, options: GuairaChapterOptions = {}): GuairaChapterSession | null {
        if (!this.isCurrentGeneration(from)) return null;
        // Validate/create before closing: malformed runtime options cannot destroy the current session.
        const replacement = new GuairaChapterSession({ opening: options.opening ?? this.opening });
        this.dispose();
        return replacement;
    }

    /** Idempotent. Read-only receipts remain inspectable, but no action can run again. */
    dispose(): void {
        if (this.closed) return;
        this.closed = true;
        this.activeAttempt = null;
        this.advanceGeneration();
    }

    private nextRecommendedScene(): GuairaChapterSceneId | null {
        return this.route.find(scene => !this.accepted.has(scene)) ?? null;
    }

    private makeGeneration(): GuairaChapterGeneration {
        return Object.freeze({ sessionId: this.sessionId, generation: this.generationNumber });
    }

    private advanceGeneration(): void {
        this.generationNumber++;
        this.currentGeneration = this.makeGeneration();
    }

    private isCurrentGeneration(from: GuairaChapterGeneration): boolean {
        return !this.closed && from.sessionId === this.sessionId && from.generation === this.generationNumber;
    }

    private matchesAttempt(a: GuairaChapterAttempt, b: GuairaChapterAttempt): boolean {
        return a.sessionId === b.sessionId && a.generation === b.generation
            && a.attemptGeneration === b.attemptGeneration && a.sceneId === b.sceneId;
    }

    private isCurrentAttempt(attempt: GuairaChapterAttempt): boolean {
        return this.isCurrentGeneration(attempt) && this.activeAttempt !== null
            && this.matchesAttempt(attempt, this.activeAttempt);
    }

    private hasLiveCompletion(attempt: GuairaChapterAttempt, live: GuairaChapterLiveResult): boolean {
        return this.isCurrentAttempt(attempt) && this.matchesAttempt(live.attempt, attempt)
            && (live.state === 'playing' || live.state === 'paused') && live.alive === true
            && this.isSceneResult(attempt.sceneId, live.result);
    }

    private beginAttempt(sceneId: GuairaChapterSceneId): GuairaChapterAttempt {
        this.advanceGeneration();
        this.activeAttempt = Object.freeze({ ...this.currentGeneration, sceneId, attemptGeneration: ++this.attemptNumber });
        return this.activeAttempt;
    }

    private isSceneResult(sceneId: GuairaChapterSceneId, result: GuairaChapterResult | null): boolean {
        if (!result || result.sceneId !== sceneId) return false;
        if (sceneId === 'guaira-lab') return result.kind === 'defeated-bull';
        if (sceneId === 'guaira-prefeito') return result.kind === 'mayor-water-released';
        return result.kind === 'reached-finish';
    }

    private transition(action: 'continue' | 'map', attempt: GuairaChapterAttempt,
        result: GuairaChapterResult | null): GuairaChapterTransition {
        let receipt: GuairaChapterReceipt | null = null;
        let newlyAccepted = false;
        if (result) {
            receipt = this.accepted.get(attempt.sceneId) ?? null;
            if (!receipt) {
                // Copy and freeze adapter input; later host changes cannot alter chapter receipts.
                receipt = Object.freeze({ sceneId: attempt.sceneId, attempt: this.activeAttempt!,
                    result: Object.freeze({ ...result }), acceptedVia: action });
                this.accepted.set(attempt.sceneId, receipt);
                newlyAccepted = true;
            }
        }
        this.activeAttempt = null;
        if (action === 'continue' || newlyAccepted || (receipt?.acceptedVia === 'runtime' && receipt.attempt === attempt)) this.selectedScene = this.nextRecommendedScene() ?? attempt.sceneId;
        this.advanceGeneration();
        return Object.freeze({ action, receipt, newlyAccepted, snapshot: this.snapshot() });
    }
}
