"use strict"

const assert = require("assert")
const path = require("path")
const postcss = require("postcss")

const stringify = require("..").stringify
const parse = require("..").parse
const { listupFixtures, writeFixture } = require("./utils")

const tests = listupFixtures(path.join(__dirname, "fixtures"), {
    exists: ["stringify.css"],
})

describe("stringify", () => {
    for (const fixture of tests) {
        it(`stringifies ${fixture.name}`, () => {
            const stylus = fixture.contents["input.styl"]
            const root = parse(stylus, { from: `${fixture.name}/input.styl` })
            const output = root.toString(stringify)
            assert.strictEqual(output.trim(), stylus.trim())
        })
    }

    for (const fixture of tests) {
        it(`css stringifies ${fixture.name}`, () => {
            const stylus = fixture.contents["input.styl"]
            const root = parse(stylus, { from: `${fixture.name}/input.styl` })

            const actual = root.toString()
            try {
                const expect = fixture.contents["stringify.css"]
                assert.strictEqual(actual, expect)
            } catch (e) {
                writeFixture(fixture.files["stringify.css"], actual)
                throw e
            }
        })
    }

    it("stringifies empty block", () => {
        assert.strictEqual("a{}", postcss.parse("a{}").toString(stringify))
    })
})
