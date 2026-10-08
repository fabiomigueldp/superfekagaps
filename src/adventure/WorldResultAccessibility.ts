import { DisposalScope } from '../engine/DisposalScope';
import { campaignJournal } from './CampaignJournal';
import type { AdventureSave } from './types';

interface ResultReceipt { heading: string; lines: readonly string[]; }

export function clearResultReceipt(name: string, seconds: number, coins: number, secret: boolean, recordEligible: boolean): ResultReceipt {
    return {
        heading: secret ? 'CAMINHO SECRETO!' : 'FASE CONCLUÍDA!',
        lines: [name, `${Math.round(seconds)} segundos · ${coins} moedas`,
            ...(!recordEligible ? ['TEMPO PARCIAL · SEM RECORDE'] : [])],
    };
}

export function endingResultReceipt(save: AdventureSave): ResultReceipt {
    const journal = campaignJournal(save);
    return {
        heading: 'UMA VITÓRIA E TANTO!',
        lines: ['FEKA SALVOU YASMIN?', `${journal.completed}/${journal.total} TRECHOS · ${save.seals.length}/72 SELOS`,
            journal.waterReleased ? 'GUAÍRA: ÁGUA LIBERADA' : 'GUAÍRA: A ÁGUA AINDA ESPERA',
            `${journal.optionalCompleted}/3 DESVIOS OPCIONAIS CONCLUÍDOS`],
    };
}

let nextReceiptId = 0;
/** Reading equivalent of the painted result, also describing its continuation.
 * Static content avoids competing live announcements with menu feedback. */
export class WorldResultAccessibility {
    private readonly lifetime = new DisposalScope();
    readonly root = document.createElement('section');
    private key = '';

    constructor(private readonly canvas: HTMLCanvasElement) {
        this.root.id = `world-result-receipt-${++nextReceiptId}`;
        this.root.className = 'world-result-accessibility';
        this.root.hidden = true;
        this.root.setAttribute('aria-label', 'Resultado da aventura');
        this.root.setAttribute('lang', 'pt-BR');
        Object.assign(this.root.style, {
            position: 'absolute', width: '1px', height: '1px', padding: '0', margin: '-1px',
            overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', border: '0',
        });
        document.body.append(this.root);
        this.lifetime.listen(document, 'visibilitychange', () => { if (document.hidden) this.clear(); });
        this.lifetime.add(() => this.root.remove());
    }

    /** Return the description ID before the native continuation receives focus. */
    sync(receipt: ResultReceipt | null): string | undefined {
        if (this.lifetime.isDisposed) return;
        if (!receipt || document.hidden || this.canvas.inert) { this.clear(); return; }
        const key = JSON.stringify(receipt);
        if (key !== this.key) {
            this.key = key;
            const heading = document.createElement('h2'); heading.textContent = receipt.heading;
            const lines = receipt.lines.map(text => { const p = document.createElement('p'); p.textContent = text; return p; });
            this.root.replaceChildren(heading, ...lines);
        }
        if (this.root.hidden) this.root.hidden = false;
        return this.root.id;
    }

    clear(): void {
        if (!this.key && this.root.hidden) return;
        this.key = ''; this.root.hidden = true; this.root.replaceChildren();
    }
    dispose(): void { this.clear(); this.lifetime.dispose(); }
}
