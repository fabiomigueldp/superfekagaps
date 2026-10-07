import { JuiceLabHost } from '../experimental/JuiceLabHost';
import type { WorldAudio } from '../WorldAudio';
import { panel, pixelText } from '../../graphics/BitmapFont';

export const FACTORY_SALON_RETURN_HOLD_MS = 1600;

/** Real presentation grants passage; a real defeat earns victory before the exit scene. */
export class FactorySalonSession extends JuiceLabHost {
    private passage = false;
    private routeRequired = true;
    private passageNoticeMs = 0;
    private won = false;
    private completedForMs = 0;
    /** Real defeat is earned immediately, including departure during the final bounce. */
    get earnedVictory(): boolean { return !this.isDisposed && this.won; }
    get readyToReturn(): boolean {
        return !this.isDisposed && !document.hidden && this.state === 'playing' && this.victorious
            && this.completedForMs >= FACTORY_SALON_RETURN_HOLD_MS;
    }
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
        if (this.isDisposed) return;
        const completeBeforeUpdate = this.victorious;
        if (this.state === 'playing' && Number.isFinite(dt) && dt > 0)
            this.passageNoticeMs = Math.max(0, this.passageNoticeMs - dt);
        super.update(dt);
        if (this.boss?.phase === 'defeated' && this.boss.health === 0 && !this.player.data.isDead) this.won = true;
        if (!this.victorious) this.completedForMs = 0;
        else if (completeBeforeUpdate && this.state === 'playing' && !document.hidden && Number.isFinite(dt) && dt > 0)
            this.completedForMs = Math.min(FACTORY_SALON_RETURN_HOLD_MS, this.completedForMs + Math.min(dt, 100));
        if (!this.isDisposed && this.intro && !['establish', 'walk', 'push', 'prepare'].includes(this.intro.beat))
            this.passage = true;
    }
    override render(): void {
        super.render();
        if (this.victorious && this.state === 'playing') {
            const c = this.renderer.getContext();
            panel(c, 60, 24, 200, 14, '#211b30', '#ae8c61');
            pixelText(c, 'VOLTANDO À FÁBRICA...', 160, 28, '#fff0d4', 1, 'center');
            this.renderer.present();
        }
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
            ? 'Turbosuco derrotado. Vitória registrada. Voltando à fase para seguir viagem.' : 'Encerramento da competição. Seguir viagem volta à fase.'
            : this.player.data.isDead ? 'Feka caiu · a luta reinicia automaticamente' : nativeMessage;
        if (status.textContent !== message) status.textContent = message;
    }
    get victorious() { return this.epilogue.frame?.beat === 'complete'; }
}
