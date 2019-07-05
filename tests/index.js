"use strict"

const assert = require("assert")
const postcss = require("postcss")

const stylusPostcss = require("../")

it("parse stylus as postcss syntax", () => {
    const result = postcss().process(
        `
@font-face
  family-name "A;' /**/"
`,
        { syntax: stylusPostcss }
    ).root
    assert.strictEqual(typeof result, "object")
    console.log("------------")
    console.log(result.toString())
    console.log("------------")
    assert.strictEqual(result.toString(), "object")
})

it("parse css as postcss syntax", () => {
    const result = postcss().process(
        `
span { color: green }
`,
        { syntax: stylusPostcss }
    ).root
    assert.strictEqual(typeof result, "object")
    console.log("------------")
    console.log(result.toString())
    assert.strictEqual(result.toString(), "object")
})
