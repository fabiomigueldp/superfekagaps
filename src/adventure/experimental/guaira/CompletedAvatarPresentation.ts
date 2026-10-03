import type { Renderer } from '../../../engine/Renderer';
import { GroundPoundState, type CameraData, type PlayerData } from '../../../types';

/** Only the completed avatar's paint advances; native player/world state stays frozen. */
export class CompletedAvatarPresentation {
    private elapsed = 0;

    reset() { this.elapsed = 0; }
    advance(dt: number) { this.elapsed += dt; }

    draw(renderer: Renderer, player: PlayerData, camera: CameraData) {
        // Completion must never replace or animate a native death presentation.
        if (player.isDead) { renderer.drawPlayer(player, camera); return; }
        const remaining = (timer = 0) => Math.max(0, timer - this.elapsed);
        const recovering = player.groundPoundState === GroundPoundState.RECOVERY;
        const view: PlayerData = {
            ...player,
            invincibleTimer: remaining(player.invincibleTimer),
            landingTimer: remaining(player.landingTimer),
            miniFantaTimer: remaining(player.miniFantaTimer),
            groundPoundTimer: recovering ? remaining(player.groundPoundTimer) : player.groundPoundTimer,
            groundPoundState: recovering && remaining(player.groundPoundTimer) === 0
                ? GroundPoundState.NONE : player.groundPoundState,
        };
        renderer.drawPlayer(view, camera, undefined, this.elapsed);
    }
}
