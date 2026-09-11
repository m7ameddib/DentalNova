import { useLayoutEffect, useRef } from 'react';
import { getZoliquaToothMeta, ZOLIQUA_TEMPLATE_SVG } from './zoliqua-teeth-data';
import { mirrorSvgVertical, parseToothSvg, rotateSvg180 } from './zoliqua-svg-utils';

interface ToothGraphicProps {
  toothNumber: number;
  selected?: boolean;
  printLayout?: boolean;
}

const preparedSvgCache = new Map<number, SVGSVGElement>();

function getPreparedSvg(toothNumber: number): SVGSVGElement {
  let proto = preparedSvgCache.get(toothNumber);
  if (!proto) {
    const { placement } = getZoliquaToothMeta(toothNumber);
    const raw = ZOLIQUA_TEMPLATE_SVG[placement.tpl];
    proto = parseToothSvg(raw);
    if (placement.rot === 180) rotateSvg180(proto);
    if (placement.mirror) mirrorSvgVertical(proto);
    preparedSvgCache.set(toothNumber, proto);
  }
  return proto.cloneNode(true) as SVGSVGElement;
}

/**
 * ZoliQua React-Odontogram-Modul SVG templates (base outline + healthy pulp).
 * Orientation matches MEASURED_TOOTH_TEMPLATE from the source project.
 */
export function ToothGraphic({ toothNumber, selected = false, printLayout = false }: ToothGraphicProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const { kind, cellWidth, aspectRatio } = getZoliquaToothMeta(toothNumber, printLayout);
  const height = Math.round(cellWidth * aspectRatio);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren(getPreparedSvg(toothNumber));
  }, [toothNumber]);

  return (
    <div
      ref={hostRef}
      className={`do-graphic do-graphic--${kind}${selected ? ' do-graphic--selected' : ''}`}
      style={{
        width: cellWidth,
        height,
        ['--do-ar' as string]: String(aspectRatio),
      }}
      aria-hidden="true"
    />
  );
}
