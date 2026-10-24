export type Usage = {
  model: string
  effort: string | null
  ctx: number | null
  h5: number | null
  h5Reset: string | null
  d7: number | null
  d7Reset: string | null
}

declare module 'claude-code' {
  interface PluginState {
    'usage-line': { usage: Usage | null; effort: string | null }
  }
}
