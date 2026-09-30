import { PLAYER_SPEED } from '../constants';
import type { InputState, PlayerData, Rect } from '../types';
import { ProgressStore } from './progress';
import type { AdventureStage } from './types';

export type Lesson = 'jump' | 'run' | 'pound';
export interface TutorialCue {
    lesson: Lesson;
    lines: [string, string];
}

/** World-only instruction. A key press alone never completes a lesson. */
export class WorldTutorial {
    private jumped = false;
    private runDistance = 0;
    constructor(private store: ProgressStore) { }

    resetAttempt() { this.jumped = false; this.runDistance = 0; }
    learned(lesson: Lesson) { return this.store.save.seen.includes(`control:${lesson}`); }

    observe(player: PlayerData, previous: Rect, input: InputState, jumpStarted: boolean, switchActivated: boolean) {
        if (player.isDead) {
            this.resetAttempt();
            return;
        }
        this.jumped ||= jumpStarted;
        if (this.jumped && player.isGrounded) {
            this.store.markSeen('control:jump');
            this.jumped = false;
        }
        // Require actual grounded travel above walking speed, not Shift held against a wall.
        const dx = Math.abs(player.position.x - previous.x);
        if (player.isGrounded && input.run && (input.left || input.right) && Math.abs(player.velocity.x) > PLAYER_SPEED && dx > .5 && dx < 10) {
            this.runDistance += dx;
            if (this.runDistance >= 48)
                this.store.markSeen('control:run');
        }
        else
            this.runDistance = 0;
        if (switchActivated)
            this.store.markSeen('control:pound');
    }

    cue(stage: AdventureStage, player: PlayerData, touch: boolean): TutorialCue | null {
        if (player.isDead || (player.respawnRevealTimer ?? 0) > 0 || stage.encounter)
            return null;
        const x = player.position.x / 16, feet = (player.position.y + player.height) / 16;
        // Broad, enemy-free ground before the first step, with another chance after checkpoint 1.
        const opening = stage.id === '1-1' && (x >= 1 && x < 25 || x >= 62 && x < 77) || stage.id === '1-2' && x >= 1 && x < 15;
        if (opening && feet <= 14.1 && feet >= 6) {
            if (!this.learned('jump'))
                return { lesson: 'jump', lines: [touch ? '↑ PARA PULAR' : 'ESPAÇO / W / ↑ PARA PULAR', 'Pule e aterrisse no chão seguro.'] };
            if (!this.learned('run') && player.isGrounded)
                return { lesson: 'run', lines: [touch ? 'SEGURE X + → PARA CORRER' : 'SEGURE SHIFT / X + → PARA CORRER', 'Experimente neste chão seguro.'] };
        }
        // First lift and first conveyor have a switch on wide, quiet ground.
        const button = ['2-2', '3-2'].includes(stage.id) ? stage.mechanisms.find(m => m.kind === 'switch') : undefined;
        if (!this.learned('pound') && button && Math.abs(player.position.x + player.width / 2 - (button.x + button.width / 2)) < 80 && Math.abs(player.position.y + player.height - (button.y + button.height)) < 110)
            return { lesson: 'pound', lines: [touch ? 'PULE ↑, DEPOIS ↓ NO AR' : 'PULE, DEPOIS S / ↓ NO AR', 'Acerte o botão com uma sentada.'] };
        return null;
    }
}
