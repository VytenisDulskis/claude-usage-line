import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Usage } from '../types'

const usage = atom({ plugin: 'usage-line', key: 'usage' } as const, null)
const effort = atom({ plugin: 'usage-line', key: 'effort' } as const, null)

const DAYS = ['Sk', 'Pr', 'An', 'Tr', 'Kt', 'Pn', 'Št']

const pad = (n: number) => String(n).padStart(2, '0')

function resetTime(iso: string | undefined, withDay: boolean) {
  if (!iso) return null
  const d = new Date(iso)
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return withDay ? `${DAYS[d.getDay()]} ${hm}` : hm
}

const level = (pct: number) => (pct >= 80 ? 'error' : pct >= 50 ? 'warning' : 'success')

function bar(pct: number | null, width: number) {
  const p = pct ?? 0
  const filled = Math.min(width, Math.floor((p / 100) * width))
  return { bar: '#'.repeat(filled) + '-'.repeat(width - filled), pct: `${p.toFixed(0).padStart(3)}%` }
}

async function refresh($: EngineInterface) {
  const u = await $.session.usage()
  const h5 = u.rateLimits.find(r => r.kind === 'five_hour')
  const d7 = u.rateLimits.find(r => r.kind === 'seven_day')
  const next: Usage = {
    model: prettyModel(await $.session.model()),
    effort: await read($, effort),
    ctx: u.context.percent ?? null,
    h5: h5?.percentUsed ?? null,
    h5Reset: resetTime(h5?.resetsAt, false),
    d7: d7?.percentUsed ?? null,
    d7Reset: resetTime(d7?.resetsAt, true),
  }
  await update($, usage, () => next)
  $.ui.status(undefined)
}

// "claude-opus-5-5" -> "Opus 5.5", "claude-opus-5" -> "Opus 5", "claude-sonnet-4-5-20250929" -> "Sonnet 4.5"
function prettyModel(id: string) {
  const m = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?!\d)/.exec(id)
  if (!m) return id
  const name = `${m[1][0].toUpperCase()}${m[1].slice(1)}`
  return m[3] === undefined ? `${name} ${m[2]}` : `${name} ${m[2]}.${m[3]}`
}

// Senas komandinis statusline dubliuotų šią eilutę: išimam jį iš settings failų.
// Vartotojo ir projekto vietinius (settings.local.json) tvarkom patys, apie bendrą projekto failą tik pranešam.
let oldStatusLineChecked = false

async function removeOldStatusLine($: EngineInterface) {
  if (oldStatusLineChecked) return
  oldStatusLineChecked = true

  const configDir =
    (await $.env.get('CLAUDE_CONFIG_DIR')) ??
    `${(await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))}/.claude`
  const files = {
    user: `${configDir.replace(/[\\/]+$/, '')}/settings.json`,
    local: '.claude/settings.local.json',
    project: '.claude/settings.json',
  } as const

  for (const source of ['user', 'local', 'project'] as const) {
    if ((await $.settings.read({ source })).statusLine === undefined) continue
    const path = files[source]

    if (source === 'project') {
      $.ui.toast(`usage-line: senas statusLine yra projekto ${path}, išimk jį ranka`)
      continue
    }

    try {
      const settings = JSON.parse(await $.fs.read(path))
      if (settings.statusLine === undefined) {
        $.ui.toast(`usage-line: senas statusLine įjungtas, bet ${path} jo neturi`)
        continue
      }
      delete settings.statusLine
      await $.fs.write(path, JSON.stringify(settings, null, 2) + '\n')
      $.ui.toast(`usage-line: senas statusLine išimtas iš ${path}`)
    } catch (err) {
      $.ui.toast(`usage-line: nepavyko išimti seno statusLine iš ${path}: ${err}`)
    }
  }
}

// Vieta, kurią eilutėje užima Claude Code režimo ženklas (⏵⏵ auto mode on ·) ir paraštės
const RESERVED = 24

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await removeOldStatusLine($)
    await refresh($)
    return r
  })

  on('session.measure', async ($, e, next) => {
    const r = await next(e)
    await removeOldStatusLine($)
    await refresh($)
    return r
  })

  on('turn.step', async function* ($, e, next) {
    if (e.effort !== undefined && String(e.effort) !== (await read($, effort))) {
      await update($, effort, () => String(e.effort))
      await refresh($)
    }
    return yield* next(e)
  })

  // Apatinė eilutė po įvedimo laukeliu: Claude Code užuomina, po jos mūsų duomenys
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const u = await read($, usage)
    if (u === null) return next(e)

    const hint = e.props.hint.replace(/\(shift\+tab to cycle\)/g, '').trim()

    // Juostų plotis pagal terminalo plotį: 3 juostos dalinasi likusia vieta;
    // siaurame lange juostos trumpėja, o kai nebetelpa net trumpos, lieka tik skaičiai
    const head = `${u.model} ${u.effort ?? '–'} `
    const tail = `  5h  ${u.h5Reset ?? '--:--'}  7d  ${u.d7Reset ?? '--'}` + '100%'.repeat(3)
    const free = (e.viewport?.columns ?? 120) - RESERVED - (hint ? hint.length + 2 : 0) - head.length - tail.length
    const each = Math.floor(free / 3) - 1
    const width = each >= 4 ? Math.min(30, each) : 0

    const { Box, Text } = $.ui.resolve(e)
    const Bar = ({ pct }: { pct: number | null }) => {
      const b = bar(pct, width)
      if (width === 0) return <Text color={level(pct ?? 0)}>{b.pct.trim()}</Text>
      return (
        <Text>
          <Text color={level(pct ?? 0)}>{b.bar}</Text> {b.pct}
        </Text>
      )
    }

    return (
      <Box flexDirection="row" columnGap={2}>
        {hint ? (
          <Box flexShrink={1}>
            <Text dimColor wrap="truncate-end">
              {hint}
            </Text>
          </Box>
        ) : null}
        <Box flexShrink={0}>
          <Text>
            <Text color="cyan">{u.model}</Text> <Text color="#87afaf">{u.effort ?? '–'}</Text>{' '}
            <Bar pct={u.ctx} />
            {'  5h '}
            <Bar pct={u.h5} /> {u.h5Reset ?? '--:--'}
            {'  7d '}
            <Bar pct={u.d7} /> {u.d7Reset ?? '--'}
          </Text>
        </Box>
      </Box>
    )
  })
}
