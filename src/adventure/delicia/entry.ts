import { DeliciaApp } from './DeliciaApp';
const original=document.getElementById('game-canvas');if(original)original.hidden=true;
const editor=document.getElementById('editor-ui');if(editor)editor.hidden=true;
new DeliciaApp();

// DeliciaApp disposes its root on pagehide. A bfcache return restores this
// document without evaluating the entry again, so mount one fresh app there.
let needsMount = false;
window.addEventListener('pagehide', () => { needsMount = true; });
window.addEventListener('pageshow', event => {
    if (!event.persisted || !needsMount) return;
    needsMount = false;
    new DeliciaApp();
});
