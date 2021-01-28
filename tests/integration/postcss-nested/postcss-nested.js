"use strict"

const semver = require("semver")
const assert = require("assert")
const path = require("path")
const postcssNested = require("postcss-nested")
const postcss = require("postcss")
const { writeFixture, listupFixtures } = require("../../utils")

const postcssStyl = require("postcss-styl")

const tests = listupFixtures(path.join(__dirname, "fixtures"))

if (semver.gte(process.version, "10.0.0")) {
    describe("postcss-nested", () => {
        for (const fixture of tests) {
            it(`postcss-nested stylus ${fixture.name}`, () => {
                const stylus = fixture.contents["input.styl"]
                return postcss([postcssNested])
                    .process(stylus, {
                        syntax: postcssStyl,
                        from: `${fixture.name}/input.styl`,
                    })
                    .then((result) => {
                        try {
                            const expect = fixture.contents["nested.styl"]
                            assert.deepStrictEqual(result.css, expect)
                        } catch (e) {
                            writeFixture(
                                fixture.files["nested.styl"],
                                result.css,
                            )
                            throw e
                        }

                        writeFixture(
                            fixture.files["nested.json"],
                            stringifyAST(result.root),
                        )

                        // check can parse
                        assert.strictEqual(
                            typeof postcssStyl.parse(result.css),
                            "object",
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
                    .then((result) => {
                        try {
                            const expect = fixture.contents["nested.css"]
                            assert.deepStrictEqual(result.css, expect)
                        } catch (e) {
                            writeFixture(
                                fixture.files["nested.css"],
                                result.css,
                            )
                            throw e
                        }

                        // check can parse
                        assert.strictEqual(
                            typeof postcssStyl.parse(result.css),
                            "object",
                        )
                    })
            })
        }
    })
}

/**
 * jsonify stylus
 * @param {*} node
 */
function stringifyAST(node) {
    return JSON.stringify(
        clean(node),
        (key, value) => {
            if (key === "source") {
                return undefined
            }
            return value
        },
        2,
    )
}

/**
 * Clean node
 */
function clean(node) {
    const result = { ...node }

    if (result.nodes) {
        result.nodes = result.nodes.map(clean)
    }
    delete result.parent
    delete result.proxyCache
    delete result.lastEach
    delete result.indexes

    return result
}
