import type { ProgressStore } from './progress';
import type { DeliciaStore } from './delicia/DeliciaProgress';
import type { WorldChapter } from './WorldChapterMap';
import type { GuairaChapterSceneId } from './experimental/guaira/chapter/GuairaChapterSession';
import './experimental/guaira/chapter/guaira-chapter-game.css';
import './experimental/guaira/guaira-touch-controls.css';

/** Lazy native runtimes share the campaign's map and stores, never another page. */
export async function mountWorldChapter(chapter: WorldChapter, stage: string, root: HTMLElement,
    store: ProgressStore, deliciaStore: DeliciaStore, back: () => void, signal: AbortSignal, entryInterrupted: () => boolean = () => false): Promise<() => void> {
    if (chapter === 'delicia') {
        const { DeliciaApp } = await import('./delicia/DeliciaApp');
        if (signal.aborted) return () => {};
        const app = new DeliciaApp(root, { store: deliciaStore, initialStage: stage, returnToWorldMap: back,
            startPaused: entryInterrupted(), preferences: store.save.preferences, savePreferences: () => { store.persist(); } });
        if (app.audio.muted === store.save.guaira.audioEnabled) app.audio.toggleMute();
        return () => { store.save.guaira.audioEnabled = !app.audio.muted; app.dispose(); };
    }
    const { GuairaChapterApp } = await import('./experimental/guaira/chapter/GuairaChapterApp');
    if (signal.aborted) return () => {};
    root.id = 'guaira-chapter-root';
    const app = new GuairaChapterApp(root, { progressStore: store, campaign: true,
        initialScene: stage as GuairaChapterSceneId | 'gallery' | 'relief', returnToWorldMap: back, exit: back });
    return () => app.dispose();
}
