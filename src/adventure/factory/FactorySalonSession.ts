import { JuiceLabHost } from '../experimental/JuiceLabHost';

/** Campaign outcome is available only after the shared real fight and epilogue. */
export class FactorySalonSession extends JuiceLabHost {
    get victorious() { return this.epilogue.frame?.beat === 'complete'; }
}
