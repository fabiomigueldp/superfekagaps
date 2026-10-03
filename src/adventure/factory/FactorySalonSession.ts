import { JuiceLabHost } from '../experimental/JuiceLabHost';
import type { WorldAudio } from '../WorldAudio';

/** Campaign outcome is available only after the shared real fight and epilogue. */
export class FactorySalonSession extends JuiceLabHost {
    inheritCampaignAudio(campaign: Pick<WorldAudio, 'enabled' | 'preferences'>): void {
        this.store.save.preferences = { ...campaign.preferences };
        if (this.reducedMotion) this.store.save.preferences.shake = false;
        this.audio.preferences = this.store.save.preferences;
        this.audio.enabled = campaign.enabled;
        this.audio.volume();
    }
    reflectCampaignStatus(status: Pick<HTMLElement, 'textContent'>, nativeMessage: string): void {
        const message = this.epilogue.frame ? this.state === 'paused' ? 'Pausado' : this.victorious
            ? 'Turbosuco derrotado. Volte à fase para registrar o resultado.' : 'Encerramento da competição'
            : this.player.data.isDead ? 'Feka caiu · a luta reinicia automaticamente' : nativeMessage;
        if (status.textContent !== message) status.textContent = message;
    }
    get victorious() { return this.epilogue.frame?.beat === 'complete'; }
}
