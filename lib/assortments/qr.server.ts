import 'server-only';

import QRCode from 'qrcode';

export async function renderAssortmentQrSvg(publicUrl: string): Promise<string> {
  return QRCode.toString(publicUrl, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512,
    color: {
      dark: '#111827',
      light: '#ffffff',
    },
  });
}
