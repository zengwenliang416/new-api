/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import DOMPurify from 'dompurify'

// Keep these allowlists aligned with pkg/model_probe/judge.go. The server's
// drawing contract uses geometry/presentation SMIL, never executable HTML/CSS.
const svgElements = [
  'svg',
  'g',
  'defs',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'title',
  'desc',
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
  'mask',
  'pattern',
  'symbol',
  'use',
  'animate',
  'animateTransform',
  'animateMotion',
  'mpath',
]
const svgAttributes = [
  'xmlns',
  'id',
  'viewBox',
  'width',
  'height',
  'preserveAspectRatio',
  'x',
  'y',
  'x1',
  'x2',
  'y1',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'd',
  'points',
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-dashoffset',
  'opacity',
  'transform',
  'clip-path',
  'clip-rule',
  'mask',
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientUnits',
  'gradientTransform',
  'spreadMethod',
  'patternUnits',
  'patternContentUnits',
  'patternTransform',
  'markerWidth',
  'markerHeight',
  'text-anchor',
  'dominant-baseline',
  'font-size',
  'font-family',
  'font-weight',
  'dx',
  'dy',
  'href',
  'xlink:href',
  'attributeName',
  'type',
  'from',
  'to',
  'by',
  'values',
  'keyTimes',
  'keySplines',
  'calcMode',
  'dur',
  'begin',
  'end',
  'repeatCount',
  'repeatDur',
  'additive',
  'accumulate',
  'path',
  'rotate',
]
const animationAttributes = new Set([
  'x',
  'y',
  'x1',
  'x2',
  'y1',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'width',
  'height',
  'd',
  'points',
  'opacity',
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dashoffset',
  'transform',
])
const localId = /^[A-Za-z_][A-Za-z0-9_.-]*$/
const localPaint = /^url\(\s*['"]?#[A-Za-z_][A-Za-z0-9_.-]*['"]?\s*\)$/

// HtmlContent uses a ShadowRoot, not an opaque origin. Model-generated probe
// output needs a stricter boundary: sanitized SVG in a sandboxed iframe.
export function createProbeArtifactDocument(html: string): string | null {
  const document = new DOMParser().parseFromString(html, 'text/html')
  const source = document.querySelector('svg')
  if (!source) return null
  const fragment = DOMPurify.sanitize(source.outerHTML, {
    ALLOWED_TAGS: svgElements,
    ALLOWED_ATTR: svgAttributes,
    ADD_TAGS: ['animate', 'animateTransform', 'animateMotion', 'mpath'],
    ADD_ATTR: [
      'attributeName',
      'type',
      'from',
      'to',
      'by',
      'values',
      'keyTimes',
      'keySplines',
      'calcMode',
      'dur',
      'begin',
      'end',
      'repeatCount',
      'repeatDur',
      'additive',
      'accumulate',
      'path',
      'rotate',
    ],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  })
  const svg = fragment.querySelector('svg')
  if (!svg) return null
  for (const element of [svg, ...svg.querySelectorAll('*')]) {
    if (
      (element.localName === 'animate' ||
        element.localName === 'animateTransform') &&
      !animationAttributes.has(element.getAttribute('attributeName') ?? '')
    ) {
      element.remove()
      continue
    }
    // Attribute removal mutates the NamedNodeMap, so iterate a stable snapshot.
    const attributes = [...element.attributes]
    for (const attribute of attributes) {
      const key = attribute.localName
      const value = attribute.value.trim()
      if (key === 'xmlns' && value === 'http://www.w3.org/2000/svg') continue
      let allowed = value.length <= 8000
      if (key === 'href') {
        allowed &&= value.startsWith('#') && localId.test(value.slice(1))
      } else if (key === 'id') {
        allowed &&= localId.test(value)
      } else if (value.toLowerCase().includes('url(')) {
        allowed &&= localPaint.test(value)
      } else {
        allowed &&= !/[\\:@/<>&\r\n]/.test(value) && !value.includes('\0')
      }
      if (!allowed) element.removeAttributeNode(attribute)
    }
  }
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; connect-src 'none'; font-src 'none'; base-uri 'none'; form-action 'none'"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}body{display:grid;place-items:center}svg{max-width:100%;max-height:100%}</style></head><body>${svg.outerHTML}</body></html>`
}
