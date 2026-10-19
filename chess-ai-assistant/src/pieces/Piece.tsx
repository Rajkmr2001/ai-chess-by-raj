import { PIECE_ART, type PieceKey } from './pieceArt';

export function isPieceKey(value: string): value is PieceKey {
  return value in PIECE_ART;
}

export function Piece({ piece, className = '' }: { piece: string; className?: string }) {
  const art = isPieceKey(piece) ? PIECE_ART[piece] : null;
  if (!art) return null;
  return (
    <svg
      viewBox="0 0 45 45"
      role="img"
      aria-hidden="true"
      focusable="false"
      className={`piece-shadow pointer-events-none block h-full w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: art }}
    />
  );
}
