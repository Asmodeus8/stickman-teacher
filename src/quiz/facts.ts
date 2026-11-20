export function isPrime(v: number): boolean {
  if (!Number.isInteger(v) || v < 2) return false;
  for (let i = 2; i * i <= v; i++) if (v % i === 0) return false;
  return true;
}

export function isSquare(v: number): boolean {
  const r = Math.round(Math.sqrt(v));
  return v > 1 && r * r === v;
}

export function numberFact(v: number): string {
  if (isSquare(v)) {
    const r = Math.round(Math.sqrt(v));
    return `${v} is a square number: ${r} × ${r}!`;
  }
  if (isPrime(v)) return `${v} is a prime number!`;
  if (v > 0 && v % 10 === 0) return `${v} is a multiple of 10!`;
  if (v > 0 && v % 5 === 0) return `${v} is in the 5 times table!`;
  if (v % 2 === 0) return `${v} is even: ${v / 2} + ${v / 2}`;
  return `${v} is an odd number`;
}

export const spoken = (text: string): string => text.replace(/×/g, 'times').replace(/:/g, ',');
