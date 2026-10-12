/** Assortments: the QR code on a pack opens a planner that only uses what is in the box. */
import 'server-only';
import QRCode from 'qrcode';
import { AssortmentDemo } from './AssortmentDemo';

/** The demo code says what it is rather than linking to a pack that does not exist. */
const QR_TEXT = 'ShowCrafter example assortment';

export function LandingAssortments() {
  const { modules } = QRCode.create(QR_TEXT, { errorCorrectionLevel: 'M' });
  const cells = Array.from({ length: modules.size * modules.size }, (_, index) =>
    Boolean(modules.data[index]),
  );
  return <AssortmentDemo qr={{ size: modules.size, cells }} />;
}
