/** Minimal, dependency-free UCI protocol handling for Stockfish.js. */

export interface EngineScore {
  type: 'cp' | 'mate';
  value: number;
  bound?: 'lower' | 'upper';
}

export interface EngineLine {
  multipv: number;
  depth: number;
  seldepth?: number;
  score?: EngineScore;
  nodes?: number;
  nps?: number;
  timeMs?: number;
  hashfull?: number;
  pv: string[];
}

export interface UciOption {
  name: string;
  type: string;
  default?: string;
  min?: number;
  max?: number;
}

export function parseInfo(line: string): EngineLine | null {
  if (!line.startsWith('info ')) return null;
  const tokens = line.split(/\s+/);
  const info: EngineLine = { multipv: 1, depth: 0, pv: [] };
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    switch (token) {
      case 'depth':
        info.depth = Number(tokens[++i]) || 0;
        break;
      case 'seldepth':
        info.seldepth = Number(tokens[++i]) || 0;
        break;
      case 'multipv':
        info.multipv = Number(tokens[++i]) || 1;
        break;
      case 'score': {
        const type = tokens[++i];
        const value = Number(tokens[++i]);
        if (type === 'cp' || type === 'mate') {
          info.score = { type, value: Number.isFinite(value) ? value : 0 };
          const bound = tokens[i + 1];
          if (bound === 'lowerbound' || bound === 'upperbound') {
            info.score.bound = bound === 'lowerbound' ? 'lower' : 'upper';
            i++;
          }
        }
        break;
      }
      case 'nodes':
        info.nodes = Number(tokens[++i]) || 0;
        break;
      case 'nps':
        info.nps = Number(tokens[++i]) || 0;
        break;
      case 'time':
        info.timeMs = Number(tokens[++i]) || 0;
        break;
      case 'hashfull':
        info.hashfull = Number(tokens[++i]) || 0;
        break;
      case 'pv':
        info.pv = tokens.slice(i + 1);
        i = tokens.length;
        break;
      default:
        break;
    }
  }
  if (!info.pv.length || !info.score) return null;
  return info;
}

export function parseBestMove(line: string): { bestMove: string | null; ponder?: string } | null {
  if (!line.startsWith('bestmove')) return null;
  const tokens = line.split(/\s+/);
  const raw = tokens[1];
  const bestMove = !raw || raw === '(none)' ? null : raw;
  const ponderIndex = tokens.indexOf('ponder');
  const ponder = ponderIndex >= 0 ? tokens[ponderIndex + 1] : undefined;
  return { bestMove, ponder };
}

export function parseIdName(line: string): string | null {
  const match = line.match(/^id name (.+)$/);
  return match ? match[1].trim() : null;
}

export function parseOption(line: string): UciOption | null {
  if (!line.startsWith('option name ')) return null;
  const nameMatch = line.match(/^option name (.+?) type (\S+)(.*)$/);
  if (!nameMatch) return null;
  const option: UciOption = { name: nameMatch[1], type: nameMatch[2] };
  const rest = nameMatch[3];
  const def = rest.match(/default (\S+)/);
  if (def) option.default = def[1];
  const min = rest.match(/ min (-?\d+)/);
  if (min) option.min = Number(min[1]);
  const max = rest.match(/ max (-?\d+)/);
  if (max) option.max = Number(max[1]);
  return option;
}

export function isInfoLine(line: string): boolean {
  return line.startsWith('info ');
}
