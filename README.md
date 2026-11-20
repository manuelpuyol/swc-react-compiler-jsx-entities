# SWC `reactCompiler` rewrites JSX text entities as literal characters

Reproduction for an SWC bug. With `jsc.transform.reactCompiler` enabled, entities in JSX text (`&nbsp;`, `&#32;`) are printed as the literal characters they decode to, even in functions the compiler does not compile. Whitespace written as an entity then gets trimmed:

- SWC's own JSX transform drops `&#32;` on its own line (the behavior fixed in swc-project/swc#11392).
- With `runtime: "preserve"`, `&nbsp;` becomes a literal U+00A0, which OXC, TypeScript and esbuild trim from multi-line JSX text.

```sh
npm install
npm run repro
```

`repro.mjs` transforms `input.jsx` with and without `reactCompiler`, in `preserve` and `automatic` mode, then lowers the `preserve` output with `oxc-transform`. It exits 1 while the bug is present.

Versions: `@swc/core` 1.16.22, `oxc-transform` 0.158.0, Node 26.

See [ISSUE.md](ISSUE.md) for the full write-up and the likely cause in `crates/swc_ecma_react_compiler`.
