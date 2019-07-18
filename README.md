# stylus-postcss

PostCSS parser plugin for converting Stylus syntax to PostCSS nodes.

## Install

```bash
npm --save install stylus-postcss
```

## Usage

### Stylus to PostCSS Nodes

The main use of this plugin is to apply the Stylus syntax to the PostCSS linter.

For example, when used with [Stylelint], it is used as follows:

- CLI

```bash
stylelint ... --custom-syntax stylus-postcss
```

- Node.js

```js
const stylelint = require("stylelint")
const syntax = require("postcss-syntax")

stylelint.lint({
  customSyntax: syntax({
    stylus: stylusPostcss
  }),
  ...
})
```

- with PostCSS

```js
const postcss = require("postcss")
const syntax = require("postcss-syntax")
const stylusPostcss = require("stylus-postcss")

postcss([
  require("stylelint"),
  require("reporter")
])
  .process(css, {
    from: "lib/app.styl",
    syntax: syntax({
      stylus: stylusPostcss
    })
  })
})
```

### Stylus Transformations

Also you can use this parser plugin to apply PostCSS transformations directly to the Stylus source code.

For example, Stylus sources can be automatically prefixed using [Autoprefixer].

```js
const postcss = require("postcss")
const autoprefixer = require("autoprefixer")
const stylusPostcss = require("stylus-postcss")

const stylusCode = `
a
  transform scale(0.5)
`
postcss([autoprefixer])
  .process(stylusCode, {
      syntax: stylusPostcss,
  })
  .then(result => {
    console.log(result.css)
    // ->
    // a
    //   -webkit-transform scale(0.5);
    //   -moz-transform scale(0.5);
    //   transform scale(0.5)
  })
```

[Stylelint]:    http://stylelint.io/
[Autoprefixer]:   https://github.com/postcss/autoprefixer
