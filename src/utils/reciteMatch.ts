import { Converter } from 'opencc-js/t2cn'
import { pinyin } from 'pinyin-pro'

const t2s = Converter({ from: 'tw', to: 'cn' })

function normalizeReciteText(text: string): string {
  return t2s(text).replace(/[^一-鿿]/g, '')
}

function toPinyin(text: string): string {
  return pinyin(text, { toneType: 'none', separator: '' })
}

function normalizeAccent(p: string): string {
  return p.replace(/zh/g, 'z').replace(/ch/g, 'c').replace(/sh/g, 's').replace(/r/g, 'y')
}

export function isReciteMatch(recited: string, expected: string): boolean {
  const normalizedRecited = normalizeReciteText(recited)
  const normalizedExpected = normalizeReciteText(expected)
  if (
    normalizedRecited === normalizedExpected ||
    normalizedRecited.includes(normalizedExpected) ||
    normalizedExpected.includes(normalizedRecited)
  ) return true

  const pinyinRecited = normalizeAccent(toPinyin(normalizedRecited))
  const pinyinExpected = normalizeAccent(toPinyin(normalizedExpected))
  return (
    pinyinRecited === pinyinExpected ||
    pinyinRecited.includes(pinyinExpected) ||
    pinyinExpected.includes(pinyinRecited)
  )
}

export function isYes(text: string): boolean {
  return /[是要降对]/.test(text) && !/不/.test(text)
}
