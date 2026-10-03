import { DisposalScope } from '../engine/DisposalScope';
import { campaignJournal } from './CampaignJournal';
import { ISLANDS } from './campaign';
import type { AdventureSave } from './types';

/** Static reading content for the painted journal. Native menu controls stay separate. */
export class JournalAccessibility {
    private readonly lifetime = new DisposalScope();
    readonly root = document.createElement('section');
    private key = '';

    constructor(private readonly canvas: HTMLCanvasElement) {
        this.root.className = 'journal-accessibility';
        this.root.hidden = true;
        this.root.setAttribute('aria-label', 'Caderno da aventura');
        this.root.setAttribute('lang', 'pt-BR');
        // Visually hidden, but available in the reading order. No live region or focus target.
        Object.assign(this.root.style, {
            position: 'absolute', width: '1px', height: '1px', padding: '0', margin: '-1px',
            overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', border: '0',
        });
        document.body.append(this.root);
        this.lifetime.listen(document, 'visibilitychange', () => { if (document.hidden) this.clear(); });
        this.lifetime.add(() => this.root.remove());
    }

    sync(page: number | null, save: AdventureSave): void {
        if (this.lifetime.isDisposed) return;
        if (page === null || document.hidden || this.canvas.inert) { this.clear(); return; }
        // The save may mutate in place. Rebuild only when this page's displayed facts change.
        const key = JSON.stringify([page, page === 7 ? [save.guaira.opening, save.guaira.completed,
            save.guaira.optional, save.seen] : null]);
        if (key === this.key) return;
        this.key = key;
        const heading = document.createElement('h2');
        const children: HTMLElement[] = [heading];
        if (page === 7) {
            const journal = campaignJournal(save);
            heading.textContent = 'Guaíra · Caderno dos Caminhos';
            const receipts = document.createElement('ul');
            for (const entry of journal.entries) {
                const item = document.createElement('li');
                item.textContent = `${entry.title}: ${entry.complete ? 'concluído' : 'pendente'}.`;
                receipts.append(item);
            }
            const water = document.createElement('p');
            water.textContent = journal.waterReleased ? 'Água liberada · Serra aberta.' : 'Água: conclua o Prefeito da Vazão.';
            const optional = document.createElement('ul');
            for (const entry of journal.optional) {
                const item = document.createElement('li');
                item.textContent = `${entry.title} (opcional): ${entry.complete ? 'concluído' : 'pendente'}.`;
                optional.append(item);
            }
            children.push(receipts, water, optional);
        } else if (page > 0 && page <= ISLANDS.length) {
            const island = ISLANDS[page - 1];
            heading.textContent = island.name;
            const description = document.createElement('p');
            description.textContent = island.description;
            children.push(description);
        } else {
            heading.textContent = 'Caderno da aventura · Sete regiões';
            // Island names and seal totals are already exposed by the native buttons.
        }
        this.root.replaceChildren(...children);
        this.root.hidden = false;
    }

    clear(): void {
        if (!this.key && this.root.hidden) return;
        this.key = '';
        this.root.hidden = true;
        this.root.replaceChildren();
    }
    dispose(): void { this.clear(); this.lifetime.dispose(); }
}
