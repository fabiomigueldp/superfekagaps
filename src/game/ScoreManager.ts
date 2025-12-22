export class ScoreManager {
    private static readonly HIGH_SCORE_KEY = 'super_feka_gaps_highscore';
    private static readonly BEST_TIME_KEY = 'super_feka_gaps_best_time';

    static getHighScore(): number {
        try {
            const stored = localStorage.getItem(this.HIGH_SCORE_KEY);
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
                localStorage.setItem(this.HIGH_SCORE_KEY, score.toString());
                return true; // New record!
            } catch (e) {
                console.warn('Failed to save high score', e);
                return false;
            }
        }
        return false;
    }

    static getBestTime(): number {
        try {
            const stored = localStorage.getItem(this.BEST_TIME_KEY);
            return stored ? parseFloat(stored) : Infinity;
        } catch (e) {
            console.warn('Failed to retrieve best time', e);
            return Infinity;
        }
    }

    static saveBestTime(time: number): boolean {
        const currentBest = this.getBestTime();
        if (time < currentBest) {
            try {
                localStorage.setItem(this.BEST_TIME_KEY, time.toString());
                return true; // New record!
            } catch (e) {
                console.warn('Failed to save best time', e);
                return false;
            }
        }
        return false;
    }
}
