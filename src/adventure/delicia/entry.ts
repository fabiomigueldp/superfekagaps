import { DeliciaApp } from './DeliciaApp';
const original=document.getElementById('game-canvas');if(original)original.hidden=true;
const editor=document.getElementById('editor-ui');if(editor)editor.hidden=true;
new DeliciaApp();
