"use strict"

const assert = require("assert")
const postcss = require("postcss")

const postcssStyl = require("..")

it("try", () => {
    const result = postcss().process(
        //
        `
//
o = o is defined ? o : {
    a: 'a',
    b: 'b'
}
o ?= {
    a: 'a',
    b: 'b'
}
`,
        { parser: postcssStyl, from: "try" }
    ).root
    assert.strictEqual(typeof result, "object")
    assert.strictEqual(result.toString(postcssStyl.stringify), "")
})
