/** A real Code 128 numeric barcode for the list's sixteen-digit till identifier. */
'use client';
import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
// Barcode geometry in CSS pixels, chosen to retain quiet zones within a 390 px page.
const MODULE_WIDTH = 2;
const BAR_HEIGHT = 64;
const QUIET_ZONE = 20;
/** Encodes decimal digit pairs with Code 128 C, including its checksum and quiet zones. */
export function TillBarcode({ code }: { code: string }) {
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (svg.current)
      JsBarcode(svg.current, code, {
        format: 'CODE128C',
        width: MODULE_WIDTH,
        height: BAR_HEIGHT,
        margin: QUIET_ZONE,
        displayValue: false,
      });
  }, [code]);
  return (
    <svg
      ref={svg}
      role="img"
      aria-label={`Till barcode ${code}`}
      className="h-auto w-full max-w-sm"
    />
  );
}
