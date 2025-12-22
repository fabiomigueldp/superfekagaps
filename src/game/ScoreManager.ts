export class ScoreManager {
    private static readonly STORAGE_KEY = 'super_feka_gaps_highscore';

    static getHighScore(): number {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? parseInt(stored, 10) : 0;
        } catch (e) {
            console.warn('Failed to retrieve high score', e);
            return 0;
        }
    }

    static saveHighScore(score: number): boolean {
        const currentHigh = this.getHighScore();
        if (score > currentHigh) {
            try {
                localStorage.setItem(this.STORAGE_KEY, score.toString());
                return true; // New record!
            } catch (e) {
                console.warn('Failed to save high score', e);
                return false;
            }
        }
        return false;
    }
}
