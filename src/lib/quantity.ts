// Parse / scale / pretty-format recipe quantities. Units aren't converted —
// scaling just multiplies the numeric amount, so it works for grams, tbsp, etc.

export function parseQuantity(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  let m: RegExpExecArray | null;
  // mixed number: "1 1/2"
  if ((m = /^(\d+)\s+(\d+)\/(\d+)$/.exec(s))) {
    const d = Number(m[3]);
    return d ? Number(m[1]) + Number(m[2]) / d : null;
  }
  // fraction: "3/4"
  if ((m = /^(\d+)\/(\d+)$/.exec(s))) {
    const d = Number(m[2]);
    return d ? Number(m[1]) / d : null;
  }
  // integer or decimal: "2", "1.5", ".5"
  if (/^\d*\.?\d+$/.test(s)) return parseFloat(s);
  return null;
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

// Render a number as a friendly cooking quantity (whole + common fraction,
// else a trimmed decimal).
export function formatQuantity(value: number): string {
  if (!isFinite(value)) return "";
  const whole = Math.floor(value + 1e-9);
  const frac = value - whole;

  if (frac < 0.02) return String(whole);
  if (frac > 0.98) return String(whole + 1);

  for (const den of [2, 3, 4, 8]) {
    const num = Math.round(frac * den);
    if (num > 0 && num < den && Math.abs(frac - num / den) < 0.02) {
      const g = gcd(num, den);
      const n = num / g;
      const d = den / g;
      return whole > 0 ? `${whole} ${n}/${d}` : `${n}/${d}`;
    }
  }
  return String(Math.round(value * 100) / 100);
}

// Scale a quantity string by a factor. Unparseable values are left untouched.
export function scaleQuantityText(
  raw: string | null,
  factor: number,
): string {
  if (!raw) return "";
  if (factor === 1) return raw;
  const n = parseQuantity(raw);
  if (n === null) return raw;
  return formatQuantity(n * factor);
}
