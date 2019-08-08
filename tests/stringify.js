"use strict"

const assert = require("assert")
const path = require("path")
const postcss = require("postcss")

const stringify = require("..").stringify
const Stringifier = require("../lib/stringifier")
const parse = require("..").parse
const {
    listupFixtures,
    writeFixture,
    isExistFile,
    deleteFixture,
} = require("./utils")

const tests = listupFixtures(path.join(__dirname, "fixtures")).filter(
    fixture => !isExistFile(fixture.files["error.json"])
)

describe("stringify", () => {
    for (const fixture of tests) {
        const stylus = fixture.contents["input.styl"]
        const root = parse(stylus, { from: `${fixture.name}/input.styl` })

        it(`stringifies ${fixture.name}`, () => {
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

        it(`css stringifies ${fixture.name}`, () => {
            const actual = root.toString()
            try {
                const expect = fixture.contents["stringify.css"]
                assert.strictEqual(actual, expect)
            } catch (e) {
                writeFixture(fixture.files["stringify.css"], actual)
                throw e
            }
        })

        // test for transform
        it(`transform omits stringifies ${fixture.name}`, () => {
            const transformRoot = root.clone()

            let transformed = false
            transformRoot.walkAtRules(node => {
                if (!node.pythonic) {
                    if (node.nodes && node.nodes.length) {
                        transformed = true
                    }
                    node.pythonic = true
                }
            })
            transformRoot.walkRules(node => {
                if (!node.pythonic) {
                    transformed = true
                    node.pythonic = true
                }
            })
            transformRoot.walkDecls(node => {
                if (!node.omittedSemi) {
                    transformed = true
                    node.omittedSemi = true
                }
                if (!node.raws.stylusBetween) {
                    transformed = true
                    node.raws.stylusBetween =
                        node.raws.between.replace(":", "") || " "
                }
                if (node.value === "") {
                    transformed = true
                    node.value = "$empty"
                }
            })

            try {
                parse(transformRoot.toString(stringify), {
                    from: fixture.files["transform-omits.styl"],
                })
            } catch (_e) {
                // cannot parse?
                transformRoot.walkDecls(node => {
                    if (node.raws.stylusBetween) {
                        transformed = true
                        delete node.raws.stylusBetween
                    }
                })
            }

            if (!transformed) {
                deleteFixture(fixture.files["transform-omits.styl"])
            }
            const actual = transformRoot.toString(stringify)
            try {
                const expect = transformed
                    ? fixture.contents["transform-omits.styl"]
                    : fixture.contents["input.styl"]
                assert.strictEqual(actual, expect)
            } catch (e) {
                if (transformed) {
                    writeFixture(fixture.files["transform-omits.styl"], actual)
                }
                throw e
            }

            // check can parse
            assert.strictEqual(
                typeof parse(actual, {
                    from: fixture.files["transform-omits.styl"],
                }),
                "object"
            )
        })
        it(`transform rem raws stringifies ${fixture.name}`, () => {
            const transformRoot = root.clone()

            transformRoot.walk(node => {
                const raws = {}
                if (node.raws.stylusBetween != null) {
                    raws.stylusBetween = node.raws.stylusBetween
                }
                if (node.raws.identifier != null) {
                    raws.identifier = node.raws.identifier
                }
                if (
                    node.raws.selector &&
                    node.raws.selector.stylus &&
                    node.parent.pythonic
                ) {
                    raws.selector = node.raws.selector
                }
                node.raws = raws
            })
            const actual = transformRoot.toString(stringify)
            try {
                const expect = fixture.contents["transform-remraws.styl"]
                assert.strictEqual(actual, expect)
            } catch (e) {
                writeFixture(fixture.files["transform-remraws.styl"], actual)
                throw e
            }

            try {
                // check can parse
                assert.strictEqual(
                    typeof parse(actual, {
                        from: fixture.files["transform-remraws.styl"],
                    }),
                    "object"
                )
            } catch (e) {
                const strs = []
                new Stringifier(str => strs.push(str)).stringify(transformRoot)
                writeFixture(
                    fixture.files["transform-remraws-str.json"],
                    JSON.stringify(strs, null, 2)
                )
                throw e
            }
            deleteFixture(fixture.files["transform-remraws-str.json"])
        })
    }

    it("stringifies empty block", () => {
        assert.strictEqual("a{}", postcss.parse("a{}").toString(stringify))
    })
})
