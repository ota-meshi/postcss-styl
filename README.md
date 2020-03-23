# postcss-styl

[![NPM license]](https://www.npmjs.com/package/postcss-styl)
[![NPM version]](https://www.npmjs.com/package/postcss-styl)
[![NPM downloads]](https://www.npmjs.com/package/postcss-styl)
[![Build Status]](https://github.com/ota-meshi/postcss-styl/actions?query=workflow%3ACI)
[![Greenkeeper badge](https://badges.greenkeeper.io/ota-meshi/postcss-styl.svg)](https://greenkeeper.io/)
[![Coverage Status]](https://coveralls.io/github/ota-meshi/postcss-styl?branch=master)

[PostCSS] parser plugin for converting [Stylus] syntax to [PostCSS] AST.

:::
**_This plugin is still in an experimental state_**
:::

## Installation

```bash
npm install -D postcss-styl
```

## Usage

### Lint Stylus with [stylelint]

You can use this [PostCSS] plugin to apply [Stylus] syntax to [stylelint].  
**You can use it more easily by using it with [stylelint-plugin-stylus](https://github.com/ota-meshi/stylelint-plugin-stylus).**

For example, this [PostCSS] plugin is used as follows:

1. First, prepare a script that extends [postcss-syntax].

   e.g. [custom-syntax.js](./tests/integration/stylelint/custom-syntax.js)

   ```js
   // Filename: `custom-syntax.js`
   const syntax = require("postcss-syntax");
   const postcssStyl = require("postcss-styl");

   module.exports = syntax({
     stylus: postcssStyl
   });
   ```

2. You can use the prepared script as shown in the following example.

   - via CLI

     ```bash
     stylelint ... --custom-syntax ./path/to/custom-syntax.js
     ```

   - use Node.js API

     ```js
     const stylelint = require("stylelint")
     const customSyntax = require.resolve("./path/to/custom-syntax.js")

     stylelint.lint({
       customSyntax,
       ...
     })
     ```
   
   - with [VSCode extension]

     ```js
     {
       "stylelint.customSyntax": "${workspaceFolder}/path/to/custom-syntax.js",
       "stylelint.validate": [
          ...,
          // ↓ Add "stylus" language.
          "stylus"
       ]
     }
     ```

   - with [PostCSS]

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

Also you can use this parser plugin to apply [PostCSS] transformations directly to the [Stylus] source code.

For example, [Stylus] sources can be automatically prefixed using [Autoprefixer].

```js
const postcss = require("postcss");
const autoprefixer = require("autoprefixer");
const postcssStyl = require("postcss-styl");

const stylusCode = `
a
  transform scale(0.5)
`;
postcss([autoprefixer])
  .process(stylusCode, {
    syntax: postcssStyl
  })
  .then(result => {
    console.log(result.css);
    // ->
    // a
    //   -webkit-transform scale(0.5);
    //   -moz-transform scale(0.5);
    //   transform scale(0.5)
  });
```

## Contributing

Welcome contributing!

Please use GitHub's Issues/PRs.

### Development Tools

- `npm test` runs tests and measures coverage.

## License

See the [LICENSE] file for license rights and limitations (MIT).

[postcss]: https://postcss.org/
[VSCode extension]: https://marketplace.visualstudio.com/items?itemName=stylelint.vscode-stylelint
[stylus]: http://stylus-lang.com/
[stylelint]: http://stylelint.io/
[autoprefixer]: https://github.com/postcss/autoprefixer
[postcss-syntax]: https://github.com/gucong3000/postcss-syntax
[license]: ./LICENSE
[npm license]: https://img.shields.io/npm/l/postcss-styl.svg
[npm version]: https://img.shields.io/npm/v/postcss-styl.svg
[npm downloads]: https://img.shields.io/npm/dw/postcss-styl.svg
[Build Status]: https://github.com/ota-meshi/postcss-styl/workflows/CI/badge.svg?branch=master
[Coverage Status]: https://coveralls.io/repos/github/ota-meshi/postcss-styl/badge.svg?branch=master
