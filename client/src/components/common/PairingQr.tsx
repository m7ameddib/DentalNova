import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function PairingQr({ value, label }: { value: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(value, {
      margin: 1,
      width: 168,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!src) return null;

  return (
    <figure className="clinic-sync-qr">
      <img src={src} alt={label} width={168} height={168} />
      <figcaption>{label}</figcaption>
    </figure>
  );
}
