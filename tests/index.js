"use strict"

const assert = require("assert")
const postcss = require("postcss")
const stylus = require("stylus")

const stylusPostcss = require("../")

it("PostCSS dependency", () => {
    assert.strictEqual(typeof postcss, "function")
})

it("stylus dependency", () => {
    assert.strictEqual(typeof stylus, "object")
})

it("parse stylus as postcss syntax", () => {
    const result = postcss().process(
        `
a {
  margin: 0 @width;
}
      
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
