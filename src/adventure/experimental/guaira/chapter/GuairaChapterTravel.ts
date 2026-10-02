import { GuairaMapModel, type GuairaArrival, type GuairaMetadata } from '../GuairaMapModel';
import type { GuairaMapActor } from '../GuairaMapArt';

/** Chapter movement uses the same authored road; chapter selection lives elsewhere. */
export class GuairaChapterTravel implements GuairaMapActor {
    private readonly road: GuairaMapModel;
    private position: number;
    private destination: GuairaArrival;
    private closed = false;
    facingLeft = false;
    reducedMotion = false;

    constructor(metadata: GuairaMetadata, initial: GuairaArrival = 'town') {
        this.road = new GuairaMapModel(metadata, initial);
        this.position = this.road.arrivalDistances[initial];
        this.destination = initial;
    }
    get point() { return this.road.pointAt(this.position); }
    get distance() { return this.position; }
    get targetArrival() { return this.destination; }
    get targetDistance() { return this.road.arrivalDistances[this.destination]; }
    get moving() { return !this.closed && Math.abs(this.position - this.targetDistance) > 1e-6; }
    get arrival(): GuairaArrival | null {
        return (Object.keys(this.road.arrivalDistances) as GuairaArrival[])
            .find(at => Math.abs(this.road.arrivalDistances[at] - this.position) < 1e-6) ?? null;
    }
    walkTo(arrival: GuairaArrival) {
        if (this.closed || !Object.prototype.hasOwnProperty.call(this.road.arrivalDistances, arrival)) return;
        this.destination = arrival;
        if (this.reducedMotion) this.skip();
    }
    tick(seconds: number) {
        if (!this.moving || !Number.isFinite(seconds) || seconds <= 0) return;
        const before = this.point, delta = this.targetDistance - this.position;
        // Match the free map's 170 source-image pixels/s and suspension clamp.
        this.position += Math.sign(delta) * Math.min(Math.abs(delta), Math.min(seconds, .05) * 170);
        this.facingLeft = this.point.x < before.x;
    }
    skip() { if (!this.closed) this.position = this.targetDistance; }
    setReducedMotion(reduced: boolean) {
        if (this.closed) return;
        this.reducedMotion = reduced;
        if (reduced) this.skip();
    }
    dispose() { this.closed = true; }
}
