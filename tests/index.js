"use strict"

const assert = require("assert")
const postcss = require("postcss")

const postcssStyl = require("..")

// it("try", () => {
//     const result = postcss().process(
//         //
//         `
// //a

// // Transitions
// $transition := {
//   fast-out-slow-in: cubic-bezier(0.4, 0.0, 0.2, 1),
//   linear-out-slow-in: cubic-bezier(0.0, 0.0, 0.2, 1),
//   fast-out-linear-in: cubic-bezier(0.4, 0.0, 1, 1),
//   ease-in-out: cubic-bezier(0.4, 0.0, 0.6, 1),
//   fast-in-fast-out: cubic-bezier(.25,.8,.25,1),
//   swing: cubic-bezier(.25,.8,.50,1)
// }
// `,
//         { parser: postcssStyl }
//     ).root
//     assert.strictEqual(typeof result, "object")
//     assert.strictEqual(result.toString(postcssStyl.stringify), "")
// })

describe("index", () => {
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
            { parser: postcssStyl }
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
            { parser: postcssStyl }
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
})
