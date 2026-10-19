const sf = require('stockfish')('lite-single', (line) => {
  if (/^(uciok|readyok|bestmove|info depth 12|info depth 16)/.test(line)) console.log('>', line.slice(0,220));
  if (/^bestmove/.test(line)) { sf.terminate(); process.exit(0); }
});
sf.processCommand('uci');
sf.processCommand('setoption name Hash value 32');
sf.processCommand('isready');
sf.processCommand('position startpos moves e2e4 e7e5 g1f3');
sf.processCommand('go movetime 1200');
setTimeout(()=>{ console.log('TIMEOUT'); process.exit(1); }, 15000);
