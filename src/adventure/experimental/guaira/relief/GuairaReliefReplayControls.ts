import { DisposalScope } from '../../../../engine/DisposalScope';
import type { GuairaReliefOptions, GuairaReliefRouteAPI } from './GuairaReliefChallenge';

// The free-page host reuses its buttons across mounts. Retain a held press so
// its eventual click cannot acquire the replacement scene's lease.
const presses = new WeakMap<HTMLElement, { pointer: number | null; key: number | null }>();
let nextLease = 0;

/** Replay clicks belong to the displayed native revision and the original
 * key/pointer press. Hosts must retire their owner before mounting the options. */
export function installReliefReplayControls(scope: DisposalScope, routes: GuairaReliefRouteAPI,
    primary: HTMLButtonElement, retry: HTMLButtonElement, active: () => boolean,
    replay: (options: Readonly<GuairaReliefOptions>) => void) {
    let revision = -1, lease = ++nextLease, bindings = new DisposalScope();
    for (const button of [primary, retry]) {
        const press = presses.get(button) ?? { pointer: null, key: null };
        presses.set(button, press);
        scope.listen(button, 'pointerdown', () => { press.pointer = lease; });
        scope.listen(button, 'pointercancel', () => { press.pointer = -1; });
    }
    scope.listen(window, 'keydown', event => {
        if (!['Enter', ' ', 'Spacebar'].includes(event.key)) return;
        if (event.target !== primary && event.target !== retry) return;
        const press = presses.get(event.target as HTMLElement);
        if (!press) return;
        if (event.repeat) { event.preventDefault(); return; }
        press.key = lease;
    }, true);
    const invalidate = () => { lease = ++nextLease; revision = -1; bindings.dispose(); };
    scope.add(invalidate);
    scope.listen(window, 'blur', invalidate);
    function sync() {
        if (scope.isDisposed || !active() || revision === routes.revision) return;
        invalidate(); bindings = new DisposalScope(); revision = routes.revision;
        const capturedRevision = revision, capturedLease = lease;
        for (const [button, kind] of [[primary, 'other-route'], [retry, 'retry']] as const) {
            const action = routes.capture(kind);
            if (button === retry) retry.disabled = !action;
            if (!action) continue;
            bindings.listen(button, 'click', event => {
                if (scope.isDisposed || !active() || capturedRevision !== routes.revision || capturedLease !== lease) return;
                const press = presses.get(button)!;
                const pressed = event.detail === 0 ? press.key : press.pointer;
                if (event.detail === 0) press.key = null; else press.pointer = null;
                if (pressed !== null && pressed !== capturedLease) return;
                const options = action.consume();
                if (!options) return;
                invalidate(); replay(options);
            });
        }
    }
    scope.listen(window, 'focus', sync);
    scope.listen(document, 'visibilitychange', () => { invalidate(); sync(); });
    return { sync };
}
