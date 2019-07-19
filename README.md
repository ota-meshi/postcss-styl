# postcss-styl-parser

PostCSS parser plugin for converting Stylus syntax to PostCSS nodes.

:::
***This plugin is still in an experimental state***
:::

## Install

```bash
npm install -D postcss-styl-parser
```

## Usage

### Stylus to PostCSS Nodes

The main use of this plugin is to apply the Stylus syntax to the PostCSS linter.

For example, when used with [Stylelint], it is used as follows:

1. First, prepare a script that extends `postcss-syntax`.

    e.g. [custom-syntax.js](./tests/integration/stylelint/custom-syntax.js)

    ```js
    // Filename: `custom-syntax.js`
    const syntax = require("postcss-syntax")
    const postcssStyl = require("postcss-styl-parser")

    module.exports = syntax({
        stylus: postcssStyl
    })
    ```

2. You can use the prepared script as shown in the following example.

    - with CLI

    ```bash
    stylelint ... --custom-syntax ./path/to/custom-syntax.js
    ```

    - with Node.js API

    ```js
    const stylelint = require("stylelint")
    const customSyntax = require("./path/to/custom-syntax.js")

    stylelint.lint({
      customSyntax,
      ...
    })
    ```

    - with PostCSS

    ```js
    const postcss = require("postcss")
    const customSyntax = require("./path/to/custom-syntax.js")

    postcss([
      require("stylelint"),
      require("reporter")
    ])
      .process(css, {
        from: "lib/app.styl",
        syntax: customSyntax
      })
    })
    ```

### Stylus Transformations

Also you can use this parser plugin to apply PostCSS transformations directly to the Stylus source code.

For example, Stylus sources can be automatically prefixed using [Autoprefixer].

```js
const postcss = require("postcss")
const autoprefixer = require("autoprefixer")
const postcssStyl = require("postcss-styl-parser")

const stylusCode = `
a
  transform scale(0.5)
`
postcss([autoprefixer])
  .process(stylusCode, {
      syntax: postcssStyl,
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
