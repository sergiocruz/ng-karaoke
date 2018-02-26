export interface LyricLRC {
  ti: string
  ar: string
  lines: LineLRC[],
}

export interface LineLRC {
  text: string
  time: number
}
