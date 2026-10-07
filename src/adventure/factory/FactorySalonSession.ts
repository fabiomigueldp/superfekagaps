import { JuiceLabHost } from '../experimental/JuiceLabHost';
import type { WorldAudio } from '../WorldAudio';
import { panel, pixelText } from '../../graphics/BitmapFont';

/** Story passage follows the real presentation; optional victory follows fight and epilogue. */
export class FactorySalonSession extends JuiceLabHost {
    private passage = false;
    private routeRequired = true;
    private passageNoticeMs = 0;
    /** A replay/death never revokes a real presentation made earlier in this visit. */
    get presentedAtChampionship(): boolean { return !this.isDisposed && this.passage; }
    get needsCampaignPresentation(): boolean { return this.routeRequired && !this.passage; }
    inheritCampaignPassage(presented: boolean, required = true): void {
        this.passage ||= presented; this.routeRequired = required;
    }
    protected override introFrameForPresentation() {
        const frame = super.introFrameForPresentation();
        const subtitle = frame.beat === 'establish' && this.needsCampaignPresentation
            ? { speaker: 'CALABREZZO', text: 'Quer passar pelo Controle de Qualidade? Primeiro, apresente-se!' }
            : frame.beat === 'reveal' && this.passage
                ? { speaker: 'PASSAGEM LIBERADA', text: 'Pode seguir viagem! A luta com Turbosuco é um desafio extra.' }
                : frame.subtitle;
        return { ...frame, subtitle };
    }
    override skipIntro(): void {
        const presenting = !this.isDisposed && this.labMode === 'intro' && !!this.intro;
        super.skipIntro();
        // Skipping presentation resolves its story action, not the optional fight.
        if (presenting) { this.passage = true; this.passageNoticeMs = 4500; }
    }
    override update(dt: number): void {
        if (this.state === 'playing' && Number.isFinite(dt) && dt > 0)
            this.passageNoticeMs = Math.max(0, this.passageNoticeMs - dt);
        super.update(dt);
        if (!this.isDisposed && this.intro && !['establish', 'walk', 'push', 'prepare'].includes(this.intro.beat))
            this.passage = true;
    }
    override render(): void {
        super.render();
        if (this.isDisposed || this.state !== 'playing' || this.passageNoticeMs <= 0 || this.labMode === 'intro') return;
        // A skipped scene still acknowledges its story result, below the combat HUD.
        const c = this.renderer.getContext();
        panel(c, 44, 36, 232, 14, '#211b30', '#ae8c61');
        pixelText(c, 'PASSAGEM LIBERADA · ESC: MENU', 160, 40, '#fff0d4', 1, 'center');
        this.renderer.present();
    }
    inheritCampaignAudio(campaign: Pick<WorldAudio, 'enabled' | 'preferences'>): void {
        this.store.save.preferences = { ...campaign.preferences };
        if (this.reducedMotion) this.store.save.preferences.shake = false;
        this.audio.preferences = this.store.save.preferences;
        this.audio.enabled = campaign.enabled;
        this.audio.volume();
    }
    reflectCampaignStatus(status: Pick<HTMLElement, 'textContent'>, nativeMessage: string): void {
        const message = this.epilogue.frame ? this.state === 'paused' ? 'Pausado' : this.victorious
            ? 'Turbosuco derrotado. Passagem liberada. Volte à fase para seguir viagem.' : 'Encerramento da competição'
            : this.player.data.isDead ? 'Feka caiu · a luta reinicia automaticamente' : nativeMessage;
        if (status.textContent !== message) status.textContent = message;
    }
    get victorious() { return this.epilogue.frame?.beat === 'complete'; }
}
