import { GuairaChapterApp } from './adventure/experimental/guaira/chapter/GuairaChapterApp';

import { EXPERIMENTAL_HUB_RETURN } from './adventure/experimental/hub/ExperimentalRoutes';

const root = document.getElementById('guaira-chapter-root')!;
const createChapter = () => new GuairaChapterApp(root, { exit: () => location.assign(EXPERIMENTAL_HUB_RETURN) });
let chapter = createChapter();
// Leaving/reloading ends this visit. A bfcache return starts an empty session,
// never reconstructing receipts from history or a copied query string.
window.addEventListener('pagehide', () => chapter.dispose());
window.addEventListener('pageshow', event => {
    if (event.persisted) { chapter.dispose(); chapter = createChapter(); }
});
