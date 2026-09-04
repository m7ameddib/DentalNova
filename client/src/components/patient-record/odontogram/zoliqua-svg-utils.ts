/**
 * SVG helpers for ZoliQua tooth templates — orientation transforms match src/odontogram.ts.
 * @see https://github.com/ZoliQua/React-Odontogram-Modul
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

function viewBoxCenter(svg: Element): { cx: number; cy: number } {
  const vb = svg.getAttribute('viewBox') || '0 0 40 80';
  const parts = vb.trim().split(/\s+/).map(Number);
  return {
    cx: parts[0] + parts[2] / 2,
    cy: parts[1] + parts[3] / 2,
  };
}

/** Rotate entire SVG 180° around viewBox center (lower arch). */
export function rotateSvg180(svg: SVGSVGElement): void {
  const { cx, cy } = viewBoxCenter(svg);
  const g = document.createElementNS(SVG_NS, 'g');
  while (svg.firstChild) g.appendChild(svg.firstChild);
  g.setAttribute('transform', `rotate(180 ${cx} ${cy})`);
  svg.appendChild(g);
}

/** Mirror SVG vertically (left-right) around viewBox center (left quadrants). */
export function mirrorSvgVertical(svg: SVGSVGElement): void {
  const { cx } = viewBoxCenter(svg);
  const g = document.createElementNS(SVG_NS, 'g');
  while (svg.firstChild) g.appendChild(svg.firstChild);
  g.setAttribute('transform', `scale(-1 1) translate(${-2 * cx} 0)`);
  svg.appendChild(g);
}

/**
 * Default tooth artwork only — base outline + healthy pulp (as in ZoliQua demo).
 * No clinical/treatment overlays.
 */
export function stripToDisplayToothOnly(svg: SVGSVGElement): void {
  const doc = svg.ownerDocument!;
  const base = svg.querySelector('#tooth-base');
  const beauty = svg.querySelector('#tooth-base-beauty');
  const pulp = svg.querySelector('#tooth-healthy-pulp');
  const viewBox = svg.getAttribute('viewBox') || '0 0 40 80';

  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const toothGroup = doc.createElementNS(SVG_NS, 'g');
  toothGroup.setAttribute('id', 'tooth');
  if (base) toothGroup.appendChild(base.cloneNode(true));
  if (pulp) toothGroup.appendChild(pulp.cloneNode(true));
  if (beauty) toothGroup.appendChild(beauty.cloneNode(true));
  svg.appendChild(toothGroup);

  svg.setAttribute('viewBox', viewBox);
  svg.removeAttribute('width');
  svg.removeAttribute('height');
}

export function parseToothSvg(raw: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(raw, 'image/svg+xml');
  const svg = doc.documentElement as unknown as SVGSVGElement;
  stripToDisplayToothOnly(svg);
  return svg;
}
