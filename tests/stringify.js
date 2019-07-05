"use strict"

const assert = require("assert")
const path = require("path")
const fs = require("fs")
const postcss = require("postcss")

const stringify = require("..").stringify
const parse = require("..").parse
const read = require("./utils/read")

const FIXTURES_ROOT = path.join(__dirname, "fixtures")
const tests = fs.readdirSync(FIXTURES_ROOT)

for (const name of tests) {
    it(`stringifies ${name}`, () => {
        const stylus = read(path.join(FIXTURES_ROOT, `${name}/input.styl`))
        const root = parse(stylus)
        const output = root.toString(stringify)
        assert.strictEqual(output.trim(), stylus.trim())
    })
}

for (const name of tests) {
    it(`css stringifies ${name}`, () => {
        const stylus = read(path.join(FIXTURES_ROOT, `${name}/input.styl`))
        const root = parse(stylus)

        const actual = root.toString()
        if (actual.includes("100vw;")) {
            debugger
            parse(stylus)
        }
        try {
            const expect = read(
                path.join(FIXTURES_ROOT, `${name}/stringify.css`)
            )
            assert.strictEqual(actual, expect)
        } catch (e) {
            fs.writeFileSync(
                path.join(FIXTURES_ROOT, `${name}/stringify.css`),
                actual
            )
            throw e
        }
    })
}

it("stringifies empty block", () => {
    assert.strictEqual("a{}", postcss.parse("a{}").toString(stringify))
})
