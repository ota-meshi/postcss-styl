"use strict"

const assert = require("assert")
const path = require("path")
const cases = require("postcss-parser-tests")
const postcssNested = require("postcss-nested")
const postcss = require("postcss")
const { writeFixture, listupFixtures } = require("../../utils")

const postcssStyl = require("postcss-styl")

const tests = listupFixtures(path.join(__dirname, "fixtures"))

describe("postcss-nested", () => {
    for (const fixture of tests) {
        it(`postcss-nested stylus ${fixture.name}`, () => {
            const stylus = fixture.contents["input.styl"]
            return postcss([postcssNested])
                .process(stylus, {
                    syntax: postcssStyl,
                    from: `${fixture.name}/input.styl`,
                })
                .then(result => {
                    try {
                        const expect = fixture.contents["nested.styl"]
                        assert.deepStrictEqual(result.css, expect)
                    } catch (e) {
                        writeFixture(fixture.files["nested.styl"], result.css)
                        throw e
                    }

                    writeFixture(
                        fixture.files["nested.json"],
                        stringifyAST(result.root)
                    )

                    // check can parse
                    assert.strictEqual(
                        typeof postcssStyl.parse(result.css),
                        "object"
                    )
                })
        })

        it(`postcss-nested css ${fixture.name}`, () => {
            const stylus = fixture.contents["input.css"]
            return postcss([postcssNested])
                .process(stylus, {
                    syntax: postcssStyl,
                    from: `${fixture.name}/input.styl`,
                })
                .then(result => {
                    try {
                        const expect = fixture.contents["nested.css"]
                        assert.deepStrictEqual(result.css, expect)
                    } catch (e) {
                        writeFixture(fixture.files["nested.css"], result.css)
                        throw e
                    }

                    // check can parse
                    assert.strictEqual(
                        typeof postcssStyl.parse(result.css),
                        "object"
                    )
                })
        })
    }
})

/**
 * jsonify stylus
 * @param {*} node
 */
function stringifyAST(node) {
    return JSON.stringify(
        JSON.parse(cases.jsonify(node)),
        (key, value) => {
            if (key === "source") {
                return undefined
            }
            return value
        },
        2
    )
}
