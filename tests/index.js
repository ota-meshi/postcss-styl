"use strict"

const assert = require("assert")
const postcss = require("postcss")

const stylusPostcss = require("../")

// it("try", () => {
//     const result = postcss().process(
//         //
//         `
// -pos(type, args)
//   i = 0
//   position: unquote(type)
//   {args[i]}: args[i + 1] is a 'unit' ? args[i += 1] : 0
//   {args[i += 1]}: args[i + 1] is a 'unit' ? args[i += 1] : 0

// absolute()
//   -pos('absolute', arguments)
// `,
//         { syntax: stylusPostcss }
//     ).root
//     assert.strictEqual(typeof result, "object")
//     assert.strictEqual(result.toString(), "")
// })

it("parse stylus as postcss syntax", () => {
    const result = postcss().process(
        `
body
    font 14px/1.5 Helvetica, arial, sans-serif
    button
    button.button
    input[type='button']
    input[type='submit']
        border-radius 5px
`,
        { syntax: stylusPostcss }
    ).root
    assert.strictEqual(typeof result, "object")
    assert.strictEqual(
        result.toString(),
        `
body{
    font: 14px/1.5 Helvetica, arial, sans-serif;
    button
    ,button.button
    ,input[type='button']
    ,input[type='submit']{
        border-radius: 5px}}
`
    )
})

it("parse css as postcss syntax", () => {
    const result = postcss().process(
        `
body {
    font: 14px/1.5 Helvetica, arial, sans-serif;
}
body button,
body button.button,
body input[type='button'],
body input[type='submit'] {
    border-radius: 5px;
}
`,
        { syntax: stylusPostcss }
    ).root
    assert.strictEqual(typeof result, "object")
    assert.strictEqual(
        result.toString(),
        `
body {
    font: 14px/1.5 Helvetica, arial, sans-serif;
}
body button,
body button.button,
body input[type='button'],
body input[type='submit'] {
    border-radius: 5px;
}
`
    )
})
