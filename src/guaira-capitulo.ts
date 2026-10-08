import { GuairaChapterApp } from './adventure/experimental/guaira/chapter/GuairaChapterApp';
import { ProgressStore, canContinueFromGuaira } from './adventure/progress';
import { runGuairaFlight } from './adventure/WorldGuairaFlight';
import './adventure/guaira-campaign.css';

const root = document.getElementById('guaira-chapter-root')!;
const campaign = typeof location !== 'undefined' && new URLSearchParams(location.search).get('campaign') === '1';
let flight: (() => void) | null = null;
const createChapter = () => {
    let storage: Storage | null = null;
    try { storage = window.localStorage; } catch { /* App exposes session-only warning. */ }
    const progressStore = new ProgressStore(storage);
    const travel = (to: 'factory' | 'serra') => {
        if (flight || (to === 'serra' && !canContinueFromGuaira(progressStore.save))) return;
        flight = runGuairaFlight({ from: 'guaira', to, preferences: progressStore.save.preferences, soundEnabled: progressStore.save.guaira.audioEnabled, onCancel: () => { flight = null; }, onArrive: () => {
            // Reread shared progress before changing only the destination.
            if (!progressStore.updateGuaira(progressStore.save.guaira)) return false;
            const previous = progressStore.save.selected;
            progressStore.save.selected = to === 'factory' ? '3-5' : '4-1';
            if (!progressStore.persist()) { progressStore.save.selected = previous; return false; }
            flight = null; chapter.dispose(); location.assign('./?guairaReturn=1'); return true;
        } });
    };
    return new GuairaChapterApp(root, { progressStore, campaign,
        exit: () => campaign ? travel('factory') : location.assign('./'),
        continueCampaign: () => travel('serra'), canContinueCampaign: () => canContinueFromGuaira(progressStore.save) });
};
let chapter = createChapter();
// Receipts survive leaving; native attempts always reconstruct from their start.
window.addEventListener('pagehide', () => { flight?.(); flight = null; chapter.dispose(); });
window.addEventListener('pageshow', event => {
    if (event.persisted) { chapter.dispose(); chapter = createChapter(); }
});
