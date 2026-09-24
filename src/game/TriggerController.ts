import {
  AudioTrigger, CameraTrigger, DamageTrigger, LevelData, Rect, TriggerType
} from '../types';
import { SpeechBubbleController } from '../voice/SpeechBubbleController';

interface TriggerActions {
  damage(trigger: DamageTrigger): boolean;
  audio(trigger: AudioTrigger): boolean;
}

/** Runtime state belongs to the play session, never to the editable level data. */
export class TriggerController {
  private level: LevelData | null = null;
  private contacts = new Set<string>();
  private consumed = new Set<string>();
  private dialog = new SpeechBubbleController({ fadeOutMs: 250, offset: { x: 0, y: -8 } });
  private dialogTimer = 0;

  update(deltaTime: number, level: LevelData, player: Rect, actions: TriggerActions): CameraTrigger | null {
    if (this.level !== level) {
      this.level = level;
      this.contacts.clear();
      this.consumed.clear();
      this.dialog.hideImmediate();
      this.dialogTimer = 0;
    }

    this.dialog.update(deltaTime);
    if (this.dialogTimer > 0) {
      this.dialogTimer = Math.max(0, this.dialogTimer - deltaTime);
      if (this.dialogTimer === 0) this.dialog.hide();
    }

    const contacts = new Set<string>();
    let camera: CameraTrigger | null = null;
    for (const trigger of level.triggers ?? []) {
      if (!trigger.active || player.x >= trigger.x + trigger.width ||
        player.x + player.width <= trigger.x || player.y >= trigger.y + trigger.height ||
        player.y + player.height <= trigger.y) continue;

      const wasInside = this.contacts.has(trigger.id);
      // One-shot camera zones remain applied during their first visit.
      if (this.consumed.has(trigger.id) && !(trigger.type === TriggerType.CAMERA && wasInside)) continue;
      contacts.add(trigger.id);

      let activated = false;
      switch (trigger.type) {
        case TriggerType.DAMAGE:
          activated = actions.damage(trigger);
          break;
        case TriggerType.CAMERA:
          camera = trigger;
          activated = true;
          break;
        case TriggerType.AUDIO:
          if (!wasInside) activated = actions.audio(trigger);
          break;
        case TriggerType.DIALOG:
          if (!wasInside && trigger.text.trim()) {
            this.dialog.setAnchorProvider(() => ({ x: trigger.x + trigger.width / 2, y: trigger.y }));
            this.dialog.show(trigger.text);
            this.dialogTimer = Math.max(3000, Math.min(12000, trigger.text.length * 60));
            activated = true;
          }
          break;
      }
      if (activated && trigger.oneShot) this.consumed.add(trigger.id);
    }
    this.contacts = contacts;
    return camera;
  }

  getDialogRenderState() {
    return this.dialog.getRenderState();
  }
}
