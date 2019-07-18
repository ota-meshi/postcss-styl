"use strict"

const assert = require("assert")
const path = require("path")
const postcss = require("postcss")

const stringify = require("..").stringify
const parse = require("..").parse
const { read, listupFixtures, writeFixture } = require("./utils")

const FIXTURES_ROOT = path.join(__dirname, "fixtures")
const tests = listupFixtures(FIXTURES_ROOT, { validOnly: true })

describe("stringify", () => {
    for (const name of tests) {
        it(`stringifies ${name}`, () => {
            const stylus = read(path.join(FIXTURES_ROOT, `${name}/input.styl`))
            const root = parse(stylus, { from: `${name}/input.styl` })
            const output = root.toString(stringify)
            assert.strictEqual(output.trim(), stylus.trim())
        })
    }

    for (const name of tests) {
        it(`css stringifies ${name}`, () => {
            const stylus = read(path.join(FIXTURES_ROOT, `${name}/input.styl`))
            const root = parse(stylus, { from: `${name}/input.styl` })

            const actual = root.toString()
            try {
                const expect = read(
                    path.join(FIXTURES_ROOT, `${name}/stringify.css`)
                )
                assert.strictEqual(actual, expect)
            } catch (e) {
                writeFixture(
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
})
