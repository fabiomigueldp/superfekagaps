import { GuairaChapterApp } from './adventure/experimental/guaira/chapter/GuairaChapterApp';

const root = document.getElementById('guaira-chapter-root')!;
let chapter = new GuairaChapterApp(root);
// Leaving/reloading ends this visit. A bfcache return starts an empty session,
// never reconstructing receipts from history or a copied query string.
window.addEventListener('pagehide', () => chapter.dispose());
window.addEventListener('pageshow', event => {
    if (event.persisted) { chapter.dispose(); chapter = new GuairaChapterApp(root); }
});
