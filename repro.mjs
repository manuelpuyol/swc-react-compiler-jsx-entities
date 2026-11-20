import {readFileSync} from 'node:fs'
import {transform} from '@swc/core'
import {transformSync as oxcTransform} from 'oxc-transform'

const filename = 'input.jsx'
const source = readFileSync(new URL(filename, import.meta.url), 'utf8')

const show = s => s.replace(/\u00a0/g, '<U+00A0>')
const spans = code => code.match(/<span>[\s\S]*?<\/span>/g) ?? []
const jsxCalls = code => code.match(/_jsxs?\("span", \{[^)]*\}\)/g) ?? []

async function swc(runtime, reactCompiler) {
  const {code} = await transform(source, {
    filename,
    jsc: {
      parser: {syntax: 'ecmascript', jsx: true},
      target: 'esnext',
      transform: {
        react: {runtime},
        ...(reactCompiler ? {reactCompiler: {target: '19'}} : {}),
      },
    },
  })
  return code
}

const section = (title, lines) => console.log(`## ${title}\n${lines.map(show).join('\n')}\n`)

const preservedPlain = await swc('preserve', false)
const preservedCompiled = await swc('preserve', true)
section('1. SWC, runtime: preserve, without reactCompiler', spans(preservedPlain))
section('2. SWC, runtime: preserve, with reactCompiler', spans(preservedCompiled))

// SWC alone: whitespace written as an entity is trimmed once it is no longer an entity.
section('3. SWC, runtime: automatic, without reactCompiler', jsxCalls(await swc('automatic', false)))
section('4. SWC, runtime: automatic, with reactCompiler', jsxCalls(await swc('automatic', true)))

// Downstream: OXC (like TypeScript and esbuild) trims a literal U+00A0 from multi-line JSX text.
const oxc = code => jsxCalls(oxcTransform(filename, code, {jsx: {runtime: 'automatic'}}).code)
section('5. oxc-transform on output 1 (without reactCompiler)', oxc(preservedPlain))
section('6. oxc-transform on output 2 (with reactCompiler)', oxc(preservedCompiled))

const bug = spans(preservedCompiled).some(s => !s.includes('&nbsp;') && !s.includes('&#32;'))
console.log(bug ? 'BUG: reactCompiler rewrote JSX text entities as literal characters.' : 'OK: entities preserved.')
process.exit(bug ? 1 : 0)
