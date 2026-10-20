interface Entry { rank: number; name: string; score: number; durationMs: number }
interface RankingResponse { entries: Entry[]; saved?: boolean; error?: string }

const ENDPOINT = '/api/leaderboard';
const PLAYER_ID_KEY = 'super_feka_gaps_player_id';
const PLAYER_NAME_KEY = 'super_feka_gaps_player_name';

export class GlobalScoreboard {
  private root: HTMLElement;
  private panel: HTMLDialogElement;
  private openButton: HTMLButtonElement;
  private doneButton: HTMLButtonElement;
  private form: HTMLFormElement;
  private nameInput: HTMLInputElement;
  private status: HTMLElement;
  private list: HTMLOListElement;
  private score = 0;
  private durationMs = 0;
  private canSubmit = false;
  private returnFocus: HTMLElement | null = null;

  constructor() {
    this.root = document.createElement('section');
    this.root.id = 'scoreboard-root';
    this.root.hidden = true;
    // The name pattern counts Unicode characters; maxlength counts UTF-16 units.
    this.root.innerHTML = `
      <button class="scoreboard-tab" type="button" hidden>PLACAR GLOBAL</button>
      <dialog class="scoreboard-panel" aria-labelledby="scoreboard-title">
          <div class="scoreboard-heading"><span class="scoreboard-kicker">SUPER FEKA GAPS · REMASTER</span><button class="scoreboard-close" type="button" aria-label="Fechar placar">×</button></div>
          <h2 id="scoreboard-title">HALL DOS HERÓIS</h2>
          <p class="scoreboard-subtitle">Os maiores recordes de todos os jogadores</p>
          <ol class="scoreboard-entries" aria-label="Dez maiores pontuações"></ol>
          <form class="scoreboard-form" hidden>
            <p class="scoreboard-record">NOVO RECORDE PESSOAL! <strong class="scoreboard-points"></strong> PONTOS</p>
            <label for="scoreboard-name">Seu nome no placar</label>
            <div class="scoreboard-input-row"><input id="scoreboard-name" name="name" type="text" required pattern="[\\p{L}\\p{N}][\\p{L}\\p{N} ._\\-]{1,15}" aria-describedby="scoreboard-name-help" autocomplete="nickname" spellcheck="false" placeholder="SEU NOME"><button type="submit">PUBLICAR</button></div>
            <small id="scoreboard-name-help">Use de 2 a 16 caracteres. Comece com uma letra ou número; depois, também são permitidos espaços, ponto, _ e -.</small>
            <small>Seu nome e recorde só são enviados ao clicar em Publicar.</small>
          </form>
          <p class="scoreboard-status" role="status" aria-live="polite"></p>
          <button class="scoreboard-done" type="button">VOLTAR AO JOGO</button>
      </dialog>`;
    document.body.append(this.root);
    this.panel = this.root.querySelector('.scoreboard-panel') as HTMLDialogElement;
    this.openButton = this.root.querySelector('.scoreboard-tab') as HTMLButtonElement;
    this.doneButton = this.root.querySelector('.scoreboard-done') as HTMLButtonElement;
    this.form = this.root.querySelector('.scoreboard-form') as HTMLFormElement;
    this.nameInput = this.root.querySelector('#scoreboard-name') as HTMLInputElement;
    this.status = this.root.querySelector('.scoreboard-status') as HTMLElement;
    this.list = this.root.querySelector('.scoreboard-entries') as HTMLOListElement;
    this.openButton.addEventListener('click', () => this.openPanel(this.openButton));
    this.root.querySelector('.scoreboard-close')?.addEventListener('click', () => this.closePanel());
    this.doneButton.addEventListener('click', () => this.closePanel());
    this.panel.addEventListener('close', () => this.restoreFocus());
    this.form.addEventListener('submit', event => { event.preventDefault(); void this.publish(); });
  }

  get isOpen(): boolean { return this.panel.open; }

  showEnding(score: number, durationMs: number, canSubmit: boolean): void {
    this.score = score;
    this.durationMs = durationMs;
    this.canSubmit = canSubmit;
    this.root.hidden = false;
    this.openButton.hidden = false;
    this.form.hidden = !canSubmit;
    this.form.querySelector('button[type="submit"]')?.removeAttribute('disabled');
    (this.form.querySelector('.scoreboard-points') as HTMLElement).textContent = score.toLocaleString('pt-BR');
    try { this.nameInput.value = localStorage.getItem(PLAYER_NAME_KEY) || ''; }
    catch { this.nameInput.value = ''; }
    this.status.textContent = 'Carregando placar…';
    this.openPanel();
    void this.refresh();
  }

  hide(): void {
    const hadFocus = this.panel.open || this.root.contains(document.activeElement);
    this.root.hidden = true;
    this.returnFocus = null;
    this.panel.close();
    if (hadFocus) document.querySelector<HTMLCanvasElement>('#game-canvas')?.focus({ preventScroll: true });
  }

  private openPanel(trigger: Element | null = document.activeElement): void {
    if (this.panel.open) return;
    this.returnFocus = trigger instanceof HTMLElement && trigger !== document.body
      ? trigger : document.querySelector<HTMLCanvasElement>('#game-canvas');
    this.nameInput.autofocus = !this.form.hidden;
    this.doneButton.autofocus = this.form.hidden;
    this.panel.showModal();
    this.openButton.hidden = true;
  }

  private closePanel(): void {
    this.panel.close();
    this.restoreFocus();
  }

  private restoreFocus(): void {
    // Native Escape also fires close. Ignore a queued close after a new opening.
    if (this.panel.open || this.root.hidden) return;
    this.openButton.hidden = false;
    const target = this.returnFocus;
    this.returnFocus = null;
    if (!target) return;
    if (target.isConnected && !target.closest('[hidden], [inert]')) target.focus({ preventScroll: true });
    if (!target.isConnected || document.activeElement !== target) {
      document.querySelector<HTMLCanvasElement>('#game-canvas')?.focus({ preventScroll: true });
    }
  }

  private render(entries: Entry[]): void {
    this.list.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement('li');
      empty.className = 'scoreboard-empty';
      empty.textContent = 'O placar está vazio. Seja o primeiro!';
      this.list.append(empty);
      return;
    }
    for (const entry of entries) {
      const item = document.createElement('li');
      const name = document.createElement('span');
      const points = document.createElement('strong');
      name.textContent = String(entry.rank).padStart(2, '0') + '  ' + entry.name;
      points.textContent = entry.score.toLocaleString('pt-BR');
      item.append(name, points);
      this.list.append(item);
    }
  }

  private async refresh(): Promise<void> {
    try {
      const response = await fetch(ENDPOINT, { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const data = await response.json() as RankingResponse;
      this.render(data.entries);
      // A loaded ranking can grow above the focused control on short screens.
      if (this.panel.open) this.panel.querySelector<HTMLElement>(':focus')?.scrollIntoView({ block: 'nearest' });
      this.status.textContent = '';
    } catch {
      this.status.textContent = 'Placar indisponível. Seu recorde local continua salvo.';
    }
  }

  private async publish(): Promise<void> {
    if (!this.canSubmit || !this.nameInput.validity.valid) return;
    const name = this.nameInput.value.trim().replace(/\s+/g, ' ');
    if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,15}$/u.test(name)) {
      this.status.textContent = 'Use 2 a 16 letras, números, espaços, ponto, _ ou -.';
      return;
    }
    const button = this.form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    // Keep Escape and Tab inside the dialog while the submit button is disabled.
    if (document.activeElement === button) this.nameInput.focus();
    button.disabled = true;
    this.status.textContent = 'Publicando recorde…';
    try {
      let playerId = localStorage.getItem(PLAYER_ID_KEY);
      if (!playerId) { playerId = crypto.randomUUID(); localStorage.setItem(PLAYER_ID_KEY, playerId); }
      const response = await fetch(ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, name, score: this.score, durationMs: this.durationMs })
      });
      const data = await response.json() as RankingResponse;
      if (!response.ok) throw new Error(data.error || 'Falha ao publicar. Tente novamente.');
      localStorage.setItem(PLAYER_NAME_KEY, name);
      this.render(data.entries);
      this.status.textContent = data.saved ? 'Recorde publicado! Seu nome já está no placar.' : 'Seu recorde publicado já é igual ou maior.';
      // Move focus before hiding the form, including a lost-focus fallback, but
      // do not steal it after closing or navigating to another dialog control.
      const active = document.activeElement;
      if (this.panel.open && (this.form.contains(active) || active === document.body || active === this.panel)) {
        this.doneButton.focus();
      }
      this.form.hidden = true;
      this.canSubmit = false;
    } catch (error) {
      this.status.textContent = error instanceof Error ? error.message : 'Falha ao publicar. Tente novamente.';
      button.disabled = false;
    }
  }
}
