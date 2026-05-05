export type DisplayLine = {
  text: string
  sourceLineIndex: number
  sourceCharOffset: number
}

function countChineseChars(text: string): number {
  const matches = text.match(/[一-鿿]/g)
  return matches ? matches.length : 0
}

function splitLineByClause(line: string): string[] {
  return line
    .match(/[^，。！？；、]+[，。！？；、]?/g)
    ?.map((part) => part.trim())
    .filter(Boolean) ?? []
}

export function buildDisplayLines(lines: string[]): DisplayLine[] {
  return lines.flatMap((line, sourceLineIndex) => {
    const clauses = splitLineByClause(line)
    if (!clauses.length) {
      return [{ text: line, sourceLineIndex, sourceCharOffset: 0 }]
    }

    // Split lines that have internal punctuation creating multiple clauses,
    // but only when the total line has enough characters (七言诗 or longer).
    // Five-character verse (五言诗) produces a single clause with no split.
    if (clauses.length > 1 && countChineseChars(line) >= 7) {
      let searchFrom = 0
      return clauses.map((text) => {
        const sourceCharOffset = line.indexOf(text, searchFrom)
        searchFrom = sourceCharOffset + text.length
        return { text, sourceLineIndex, sourceCharOffset }
      })
    }

    return [{ text: line, sourceLineIndex, sourceCharOffset: 0 }]
  })
}

export function getDisplaySentences(lines: string[]): string[] {
  return buildDisplayLines(lines).map((line) => line.text)
}
