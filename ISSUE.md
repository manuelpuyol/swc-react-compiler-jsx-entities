**Title:** `reactCompiler` rewrites JSX text entities as literal characters, so encoded whitespace gets trimmed

### Describe the bug

With `jsc.transform.reactCompiler` enabled, JSX text entities come back as the literal characters they decode to. This happens in every function in the file, including ones the compiler does not compile, as long as it compiles at least one function. Whitespace written as an entity then gets trimmed like plain whitespace:

- `&#32;` on its own line is dropped by SWC's own JSX transform. This is the behavior fixed in #11392, and it comes back when `reactCompiler` is on.
- `&nbsp;` survives SWC's JSX transform, but with `runtime: "preserve"` it is printed as a literal U+00A0. TypeScript, esbuild and OXC trim U+00A0 from multi-line JSX text, so the non-breaking space is lost when one of them lowers the JSX afterwards.

The cause looks like the AST round trip in `crates/swc_ecma_react_compiler`:

- `convert_ast.rs` (`convert_jsx_element_child`) passes only the decoded `value` of a `JSXText` to the compiler and drops `raw`.
- `convert_ast_reverse.rs` rebuilds `raw` with `encode_jsx_text(&text.value)`, which only escapes `& < > { }`. Other characters that were written as entities come back literal.

Keeping the original `raw` for text nodes the compiler did not change would avoid this.

### How did you encounter this bug?

A Vite build where SWC runs the React Compiler with `runtime: "preserve"`, then OXC lowers the JSX. A component with `&nbsp;` on its own line lost its space in production. The same component built with rspack (`builtin:swc-loader`, automatic runtime) kept the space. The function containing the JSX was not compiled by the React Compiler; another function in the same file was.

### Input code

```jsx
function withNbsp(label) {
  return (
    <span>
      {label}
      &nbsp;
    </span>
  )
}

function withSpace(label) {
  return (
    <span>
      {label}
      &#32;
    </span>
  )
}

export function Header({label}) {
  return (
    <div>
      {withNbsp(label)}
      {withSpace(label)}
    </div>
  )
}
```

### Config

```json
{
  "jsc": {
    "parser": {"syntax": "ecmascript", "jsx": true},
    "target": "esnext",
    "transform": {
      "react": {"runtime": "automatic"},
      "reactCompiler": {"target": "19"}
    }
  }
}
```

`runtime: "preserve"` shows the rewritten text directly.

### Link to the code that reproduces this issue

https://github.com/manuelpuyol/swc-react-compiler-jsx-entities

`npm install && npm run repro` prints the output for each case and exits 1 while the bug is present.

### SWC Info output

```
    Binaries:
        Node: 26.12.1
        npm: 11.20.0

    Relevant Packages:
        @swc/core: 1.16.22
        @swc/types: 0.1.28
```

Run on macOS arm64.

### Expected behavior

Entities in JSX text are kept as written, the same as with `reactCompiler` off:

```jsx
// runtime: "preserve"
<span>
  {label}
  &#32;
</span>
```

```js
// runtime: "automatic"
_jsxs("span", { children: [label, "\xA0"] })  // &nbsp;
_jsxs("span", { children: [label, " "] })     // &#32;
```

### Actual behavior

With `runtime: "preserve"`, both entities are printed as literal characters. `<U+00A0>` and `<space>` mark them below:

```jsx
<span>
  {label}
  <U+00A0>
</span>
<span>
  {label}
  <space>
</span>
```

With `runtime: "automatic"`, `&#32;` is dropped:

```js
_jsxs("span", { children: [label, "\xA0"] })  // &nbsp;: kept
_jsx("span", { children: label })             // &#32;: space lost
```

Lowering the `preserve` output with `oxc-transform` 0.158.0 drops both:

```js
_jsx("span", { children: label })
_jsx("span", { children: label })
```

### Version

1.16.22

### Additional context

- If no function in the file is compiled (for example, the component has `'use no memo'`), entities are kept.
- Related: #11392 (encoded whitespace trimmed in JSX) and its fix in #11474.
