"use strict"

const assert = require("assert")
const path = require("path")
const postcss = require("postcss")

const stringify = require("..").stringify
const parse = require("..").parse
const { listupFixtures, writeFixture, isExistFile } = require("./utils")

const tests = listupFixtures(path.join(__dirname, "fixtures")).filter(
    fixture => !isExistFile(fixture.files["error.json"])
)

describe("stringify", () => {
    for (const fixture of tests) {
        it(`stringifies ${fixture.name}`, () => {
            const stylus = fixture.contents["input.styl"]
            const root = parse(stylus, { from: `${fixture.name}/input.styl` })
            const output = root.toString(stringify)
            assert.strictEqual(output.trim(), stylus.trim())

            // win style linebreaks
            const stylusWin = stylus.replace(/\r\n|\r|\n/gu, "\r\n")
            if (stylusWin !== stylus) {
                const rootWin = parse(stylusWin, {
                    from: `${fixture.name}/input.styl`,
                })
                const outputWin = rootWin.toString(stringify)
                assert.strictEqual(outputWin.trim(), stylusWin.trim())
            }
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
