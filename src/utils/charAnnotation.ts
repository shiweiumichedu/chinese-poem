import type { CharAnnotation } from '../types'

export function buildTtsLine(
  line: string,
  lineIndex: number,
  annotations: CharAnnotation[],
): string {
  const relevant = annotations.filter((a) => a.lineIndex === lineIndex)
  if (!relevant.length) return line
  return Array.from(line)
    .map((char, i) => relevant.find((a) => a.charIndex === i)?.substitute ?? char)
    .join('')
}
