import { Chess } from 'chess.js';
const g = new Chess();
console.log('methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(g)).filter(m=>m.startsWith('is')||m==='move'||m==='loadPgn'||m==='pgn'||m==='history'||m==='fen'||m==='turn'||m==='board'||m==='get'||m==='undo'||m==='setHeader'||m==='moves').join(','));
const m = g.move('e4'); console.log('move e4:', JSON.stringify(m));
g.move('e5'); g.move('Nf3'); g.move('Nc6'); g.move('Bb5'); g.move('a6');
console.log('SAN list:', g.history().join(' '));
console.log('pgn:', JSON.stringify(g.pgn().slice(0,120)));
console.log('verbose fields:', Object.keys(g.history({verbose:true})[0]));
// ambiguity test
const a = new Chess('rn1qkbnr/pppbpppp/8/3p4/3P4/8/PPPBPPPP/RN1QKBNR w KQkq - 2 3');
try { console.log('ambiguous Nd2 ->', a.move('Nd2').san); } catch(e) { console.log('ambig error:', e.message); }
console.log('legal knights to d2:', a.moves().filter(x=>x.endsWith('d2')));
// en passant
const ep = new Chess('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3');
console.log('ep moves:', ep.moves({verbose:true}).filter(m=>m.flags.includes('e')).map(m=>m.san));
// promotion
const pr = new Chess('8/P6k/8/8/8/8/8/7K w - - 0 1');
console.log('promo:', pr.moves({verbose:true}).filter(m=>m.promotion).map(m=>m.san));
// load pgn
const p = new Chess();
p.loadPgn('[Event "Test"]\n\n1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0');
console.log('pgn load:', p.history().join(' '), '| over:', p.isCheckmate(), '| fen:', p.fen());
console.log('turn:', p.turn(), 'get e4:', JSON.stringify(p.get('e4')), 'board len', p.board().length);
