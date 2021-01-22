"use strict"

const assert = require("assert")
const postcss = require("postcss")

const postcssStyl = require("..")

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
            { parser: postcssStyl },
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
`,
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
            { parser: postcssStyl },
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
`,
        )
    })
})
