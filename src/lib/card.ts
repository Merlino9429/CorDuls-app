// Contenuto del QR della tessera punti: "CORDULS:CD-12345678".
// Il prefisso evita di confondere la tessera con altri QR.
const PREFIX = 'CORDULS:';
const CARD = /^CD-\d{8}$/;

export const cardQrValue = (cardNumber: string) => `${PREFIX}${cardNumber}`;

/** Restituisce il numero di tessera letto da un QR, oppure null se non è una tessera Cor Duls. */
export function parseCardQr(data: string): string | null {
  const raw = data.trim().toUpperCase();
  const card = raw.startsWith(PREFIX) ? raw.slice(PREFIX.length) : raw;
  return CARD.test(card) ? card : null;
}
