// DOMMatrix polyfill for pdfjs-dist during SSR/prerendering
// This file is injected via webpack ProvidePlugin in next.config.ts

'use strict';

class DOMMatrix {
  a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
  m11 = 1; m12 = 0; m13 = 0; m14 = 0;
  m21 = 0; m22 = 1; m23 = 0; m24 = 0;
  m31 = 0; m32 = 0; m33 = 1; m34 = 0;
  m41 = 0; m42 = 0; m43 = 0; m44 = 1;
  is2D = true;
  isIdentity = true;

  constructor(init) {
    if (init) this.setMatrixValue(init);
  }

  scale(x = 1, y = 1) { return this.multiply(new DOMMatrix(`matrix(${x}, 0, 0, ${y}, 0, 0)`)); }
  translate(x = 0, y = 0) { return this.multiply(new DOMMatrix(`matrix(1, 0, 0, 1, ${x}, ${y})`)); }
  rotate(angle = 0) {
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return this.multiply(new DOMMatrix(`matrix(${cos}, ${sin}, ${-sin}, ${cos}, 0, 0)`));
  }
  multiply(other) {
    const m = new DOMMatrix();
    m.m11 = this.m11 * other.m11 + this.m21 * other.m12;
    m.m12 = this.m12 * other.m11 + this.m22 * other.m12;
    m.m21 = this.m11 * other.m21 + this.m21 * other.m22;
    m.m22 = this.m12 * other.m21 + this.m22 * other.m22;
    m.m41 = this.m11 * other.m41 + this.m21 * other.m42 + this.m41;
    m.m42 = this.m12 * other.m41 + this.m22 * other.m42 + this.m42;
    m.a = m.m11; m.b = m.m12; m.c = m.m21; m.d = m.m22;
    m.e = m.m41; m.f = m.m42;
    m.is2D = true;
    m.isIdentity = false;
    return m;
  }
  inverse() { return new DOMMatrix(); }
  transformPoint(p) { return { x: p.x || 0, y: p.y || 0, z: 0, w: 1 }; }
  setMatrixValue(str) {
    const match = str.match(/matrix\(([^)]+)\)/);
    if (match) {
      const [a, b, c, d, e, f] = match[1].split(',').map(Number);
      this.a = a; this.b = b; this.c = c; this.d = d; this.e = e; this.f = f;
      this.m11 = a; this.m12 = b; this.m21 = c; this.m22 = d; this.m41 = e; this.m42 = f;
    }
    return this;
  }
  toString() { return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`; }
  toJSON() { return { a: this.a, b: this.b, c: this.c, d: this.d, e: this.e, f: this.f }; }
}

// Register on globalThis for SSR/prerendering contexts
globalThis.DOMMatrix = DOMMatrix;

module.exports = DOMMatrix;
module.exports.default = DOMMatrix;