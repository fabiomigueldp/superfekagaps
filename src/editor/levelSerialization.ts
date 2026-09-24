import { COLORS, GAME_HEIGHT, GAME_WIDTH, TILE_SIZE, TileType } from '../constants';
import { CollectibleType, EnemyType, TriggerType, type LevelData } from '../types';
import { normalizeLevelData } from '../world/levelValidation';

export { normalizeLevelData } from '../world/levelValidation';

const constants: Record<string, unknown> = { COLORS, GAME_HEIGHT, GAME_WIDTH, TILE_SIZE, TileType, EnemyType, CollectibleType, TriggerType };

/** A data-only reader: importing a level must never execute the selected file. */
class LevelLiteralReader {
    private offset = 0;

    constructor(private readonly source: string) {}

    private error(message: string): never {
        throw new Error(`Arquivo de nível inválido, posição ${this.offset}: ${message}.`);
    }

    private skip(): void {
        while (this.offset < this.source.length) {
            if (/\s/.test(this.source[this.offset])) this.offset++;
            else if (this.source.startsWith('//', this.offset)) {
                const end = this.source.indexOf('\n', this.offset + 2);
                this.offset = end < 0 ? this.source.length : end + 1;
            } else if (this.source.startsWith('/*', this.offset)) {
                const end = this.source.indexOf('*/', this.offset + 2);
                if (end < 0) this.error('comentário não terminado');
                this.offset = end + 2;
            } else break;
        }
    }

    private take(pattern: RegExp): string | null {
        this.skip();
        const match = pattern.exec(this.source.slice(this.offset));
        if (!match) return null;
        this.offset += match[0].length;
        return match[0];
    }

    private consume(value: string): boolean {
        this.skip();
        if (!this.source.startsWith(value, this.offset)) return false;
        this.offset += value.length;
        return true;
    }

    private expect(value: string): void {
        if (!this.consume(value)) this.error(`esperado ${JSON.stringify(value)}`);
    }

    private string(): string {
        this.skip();
        const quote = this.source[this.offset++];
        let result = '';
        while (this.offset < this.source.length) {
            const character = this.source[this.offset++];
            if (character === quote) return result;
            if (character === '\n' || character === '\r') this.error('quebra de linha dentro de texto');
            if (character !== '\\') { result += character; continue; }
            const escaped = this.source[this.offset++];
            const escapes: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0', '\\': '\\', "'": "'", '"': '"', '/': '/' };
            if (escaped === 'u' || escaped === 'x') {
                const digits = escaped === 'u' ? 4 : 2;
                const hex = this.source.slice(this.offset, this.offset + digits);
                if (!new RegExp(`^[0-9a-fA-F]{${digits}}$`).test(hex)) this.error('escape de texto inválido');
                result += String.fromCharCode(parseInt(hex, 16));
                this.offset += digits;
            } else if (Object.prototype.hasOwnProperty.call(escapes, escaped)) result += escapes[escaped];
            else this.error('escape de texto não suportado');
        }
        return this.error('texto não terminado');
    }

    private value(depth = 0): unknown {
        if (depth > 100) this.error('objetos aninhados em excesso');
        this.skip();
        const character = this.source[this.offset];
        if (character === '"' || character === "'") return this.string();
        if (this.consume('{')) {
            const result: Record<string, unknown> = Object.create(null);
            if (this.consume('}')) return result;
            do {
                this.skip();
                const first = this.source[this.offset];
                const key = first === '"' || first === "'" ? this.string() : this.take(/^[A-Za-z_$][\w$]*/);
                if (key === null) this.error('esperada uma propriedade');
                if (key === '__proto__' || Object.prototype.hasOwnProperty.call(result, key)) this.error(`propriedade inválida ou repetida: ${key}`);
                this.expect(':');
                result[key] = this.value(depth + 1);
                if (this.consume('}')) return result;
                this.expect(',');
            } while (!this.consume('}'));
            return result;
        }
        if (this.consume('[')) {
            const result: unknown[] = [];
            if (this.consume(']')) return result;
            do {
                result.push(this.value(depth + 1));
                if (this.consume(']')) return result;
                this.expect(',');
            } while (!this.consume(']'));
            return result;
        }
        const numeric = this.take(/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
        if (numeric !== null) return Number(numeric);
        const identifier = this.take(/^[A-Za-z_$][\w$]*/);
        if (identifier === 'true') return true;
        if (identifier === 'false') return false;
        if (identifier === 'null') return null;
        if (identifier && Object.prototype.hasOwnProperty.call(constants, identifier)) {
            let result = constants[identifier];
            if (this.consume('.')) {
                const member = this.take(/^[A-Za-z_$][\w$]*/);
                if (!member || !result || typeof result !== 'object' || !Object.prototype.hasOwnProperty.call(result, member)) this.error('constante desconhecida');
                result = (result as Record<string, unknown>)[member];
            }
            if (typeof result === 'number' || typeof result === 'string') return result;
        }
        return this.error('use somente objetos, listas, valores literais e constantes conhecidas');
    }

    read(): unknown {
        this.skip();
        // Accept existing TypeScript level modules and standalone JSON exports.
        // Imports are recognized syntactically, never resolved or evaluated.
        while (this.take(/^import\b/)) {
            this.take(/^type\b/);
            this.expect('{');
            if (!this.consume('}')) {
                do {
                    if (!this.take(/^[A-Za-z_$][\w$]*/)) this.error('import inválido');
                    if (this.take(/^as\b/)) this.error('aliases de import não são suportados');
                    if (this.consume('}')) break;
                    this.expect(',');
                } while (!this.consume('}'));
            }
            if (!this.take(/^from\b/)) this.error('import sem origem');
            this.skip();
            if (!['"', "'"].includes(this.source[this.offset])) this.error('origem de import inválida');
            this.string();
            this.consume(';');
        }
        const module = this.take(/^export\b/);
        if (module) {
            if (!this.take(/^const\b/)) this.error('esperado export const DATA');
            if (!this.take(/^DATA\b/)) this.error('o arquivo deve exportar DATA');
            if (this.consume(':') && !this.take(/^LevelData\b/)) this.error('tipo de DATA desconhecido');
            this.expect('=');
        }
        const result = this.value();
        if (module && this.take(/^satisfies\b/) && !this.take(/^LevelData\b/)) this.error('tipo de DATA desconhecido');
        this.consume(';');
        this.skip();
        if (this.offset !== this.source.length) this.error('código ou dados adicionais após DATA não são suportados');
        return result;
    }
}

export function parseLevelFromText(source: string): LevelData {
    return normalizeLevelData(new LevelLiteralReader(source).read());
}

/** Produce readable, type-correct modules, including enum members used by entities/triggers. */
export function serializeLevelToTS(value: LevelData): string {
    const data = normalizeLevelData(value);
    const enums = new Set<string>();
    const format = (value: unknown, depth: number, path: string[]): string => {
        const indent = '  '.repeat(depth);
        const nextIndent = `${indent}  `;
        if (path.length === 3 && path[2] === 'type') {
            const enumName = { enemies: 'EnemyType', collectibles: 'CollectibleType', triggers: 'TriggerType' }[path[0]];
            if (enumName) { enums.add(enumName); return `${enumName}.${String(value)}`; }
        }
        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            if (path.length === 2 && path[0] === 'tiles') return `[${value.join(', ')}]`;
            return `[\n${value.map((item, index) => nextIndent + format(item, depth + 1, [...path, String(index)])).join(',\n')}\n${indent}]`;
        }
        if (value && typeof value === 'object') {
            const properties = Object.entries(value).map(([key, item]) => `${nextIndent}${JSON.stringify(key)}: ${format(item, depth + 1, [...path, key])}`);
            return properties.length ? `{\n${properties.join(',\n')}\n${indent}}` : '{}';
        }
        return JSON.stringify(value);
    };
    const body = format(data, 0, []);
    const imports = `import type { LevelData } from '../../types';\n` + (enums.size ? `import { ${[...enums].sort().join(', ')} } from '../../types';\n` : '');
    return `${imports}\nexport const DATA: LevelData = ${body};\n`;
}
