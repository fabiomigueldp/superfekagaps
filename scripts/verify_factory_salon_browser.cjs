/** Chromium DOM/lifecycle QA with deterministic combat replay (not manual play).
 * Start Vite, then: FACTORY_BROWSER=/path/to/agent-browser node scripts/verify_factory_salon_browser.cjs
 * Configure executable/socket/Chromium flags through an external wrapper if needed. */
const { execFileSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');
const browser = process.env.FACTORY_BROWSER || 'agent-browser';
const replay = JSON.parse(readFileSync('tests/helpers/juiceLabReplay.json', 'utf8'));
function command(...args) {
    const data = JSON.parse(execFileSync(browser, ['--json', ...args], { encoding: 'utf8', maxBuffer: 4e6 }));
    if (!data.success) throw Error(JSON.stringify(data));
    return data.data;
}
command('open', process.env.FACTORY_URL || 'http://localhost:3000');
command('set', 'viewport', '360', '640');
const proof = command('eval', `(() => {
    const check = (condition, message) => { if (!condition) throw Error(message); };
    const g = window.worldGame; g.running = false;
    g.store.save.seen = [];
    g.store.save.completed = ['2-5', '3-1', '3-2']; g.store.save.selected = '3-3';
    g.store.save.checkpoint = { stage: '3-3', index: 1, helmet: true };
    g.store.persist(); g.load('3-3', true);
    check(g.player.data.position.x === 1712, 'old checkpoint');
    // Fixture starts on the checkpoint landing; use real Input to walk to the door.
    let canvas = document.getElementById('game-canvas'); canvas.focus();
    const key = (type, code, key) => canvas.dispatchEvent(new KeyboardEvent(type, { code, key, bubbles:true }));
    key('keydown', 'ArrowRight', 'ArrowRight');
    for(let n=0;n<30;n++) g.update(1000/60);
    key('keyup', 'ArrowRight', 'ArrowRight');
    for(let n=0;n<8;n++) g.update(1000/60);
    check(!document.querySelector('.factory-salon-enter').hidden, 'walk reaches optional entrance');
    check(224-112-g.camera.y>=24,'facade crown below HUD');
    const original = JSON.stringify({save:g.store.save,position:g.player.data.position,elapsed:g.elapsed,objects:g.objects});
    const enter = () => { document.querySelector('.factory-salon-enter').click(); canvas=document.getElementById('game-canvas'); return window.worldGame; };
    const click = text => [...document.querySelectorAll('.factory-salon button')].find(b=>b.textContent===text).click();
    let lab = enter();
    check(lab !== g && lab.labMode==='intro' && g.state==='paused', 'entry');
    check(document.querySelector('.factory-salon').open, 'modal open');
    const rect=document.querySelector('.factory-salon').getBoundingClientRect();
    check(rect.width<=360 && rect.x>=0, 'compact horizontal bounds');
    check([...document.querySelectorAll('.factory-salon button')].filter(b=>!b.hidden).every(b=>b.getBoundingClientRect().height>=44), 'touch target height');
    key('keydown','Escape','Escape'); key('keyup','Escape','Escape');
    check(lab.state==='paused' && g.state==='paused', 'Escape only pauses lab');
    const time=lab.time; g.update(100); check(lab.time===time,'paused simulation');
    key('keydown','Escape','Escape'); key('keyup','Escape','Escape');
    check(lab.state==='playing' && g.state==='paused', 'Escape only resumes lab');
    click('Voltar à fase');
    check(JSON.stringify({save:g.store.save,position:g.player.data.position,elapsed:g.elapsed,objects:g.objects})===original, 'abort restores exact campaign');
    g.update(1000/60); lab=enter();
    for(let n=0;n<31;n++) g.update(100);
    key('keydown','ArrowRight','ArrowRight');
    for(let n=0;n<240 && lab.intro?.beat!=='prepare';n++) g.update(1000/60);
    key('keyup','ArrowRight','ArrowRight');
    check(lab.intro?.beat==='prepare','walk reaches presentation mark');
    click('Apresentar pose');
    for(let n=0;n<400 && lab.labMode==='intro';n++)g.update(100);
    check(lab.labMode==='combat','full approved intro reaches combat');
    // Real damage, automatic death/retry. No fabricated boss victory.
    let died=false, restarted=false, first=lab.boss;
    for(let n=0;n<5000;n++) { g.update(1000/60); died ||= lab.player.data.isDead; if(lab.boss!==first) {restarted=true; break;} }
    check(died && restarted && !lab.victorious,'native defeat/retry');
    check(!g.store.save.seen.includes('optional:factory-salon:turbosuco'),'defeat gives no result');
    lab.load('juice-lab');
    const recording=${JSON.stringify(replay)}, mapping={left:'ArrowLeft',right:'ArrowRight',run:'ShiftLeft',jump:'Space'};
    let held=new Set(), frame=0, health=lab.boss.health, hits=[];
    for(const [count,bits] of recording.runs) {
        const next=new Set(recording.keys.flatMap((k,i)=>bits&(1<<i)&&mapping[k]?[mapping[k]]:[]));
        for(const code of held) if(!next.has(code)) key('keyup',code,code==='Space'?' ':code);
        for(const code of next) if(!held.has(code)) key('keydown',code,code==='Space'?' ':code);
        held=next;
        for(let n=0;n<count;n++,frame++) {
            g.update(1000/60); check(!lab.player.data.isDead,'recorded fight stays alive '+frame);
            if(lab.boss.health!==health){health=lab.boss.health;hits.push({frame,health});}
        }
    }
    for(const code of held) key('keyup',code,code==='Space'?' ':code);
    check(JSON.stringify(hits)===JSON.stringify(recording.expectedHits),'six production hits');
    check(lab.boss.health===0 && !lab.victorious,'victory waits for landing and epilogue');
    for(let n=0;n<120&&!lab.epilogue.frame;n++)g.update(1000/60);
    check(!!lab.epilogue.frame,'existing epilogue starts');
    window.dispatchEvent(new Event('blur'));
    const ep=JSON.stringify(lab.epilogue.frame);g.update(100);
    check(lab.state==='paused' && JSON.stringify(lab.epilogue.frame)===ep,'blur freezes epilogue');
    click('Continuar');
    for(let n=0;n<65;n++)g.update(100);
    check(lab.victorious,'epilogue naturally completed');
    g.render();
    click('Voltar à fase');
    check(g.store.save.seen.includes('optional:factory-salon:turbosuco'),'exit records optional result');
    check(!g.store.save.completed.includes('3-3') && !g.store.save.completed.includes('3-5'),'no stage/boss replacement');
    check(g.store.save.checkpoint.index===1,'checkpoint survives');
    check(JSON.parse(localStorage.getItem('super_feka_gaps_world_v1')).seen.includes('optional:factory-salon:turbosuco'),'result persisted');
    g.update(1000/60); lab=enter();
    check(lab.labMode==='intro' && !lab.victorious,'fresh reentry');
    click('Voltar à fase');
    check(g.store.save.seen.filter(id=>id==='optional:factory-salon:turbosuco').length===1,'no duplicate achievement');
    g.render();g.start();
    return {browser:'Chromium',viewport:[360,640],reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,combat:'deterministic real Input replay in browser; not manual victory',hits,checks:['old checkpoint','walk to entrance','modal','full intro with walk and pose','compact controls','Escape','abort/return','reentry','native death/retry','six-hit victory','landing','shared epilogue','blur','natural ending','optional persistence','no duplicate reward']};
})()`).result;
writeFileSync(process.env.FACTORY_PROOF || '/tmp/factory-salon-browser.json', JSON.stringify(proof, null, 2)+'\n');
console.log(JSON.stringify(proof, null, 2));
