"use strict"

const assert = require("assert")
const path = require("path")
const stylelint = require("stylelint")
const stylelintConfig = require("stylelint-config-recommended")
const { read, writeFixture, listupFixtures } = require("../../utils")

const postcssStylPath = require.resolve("../../../")

const config = Object.assign({}, stylelintConfig)
config.rules = Object.assign({}, config.rules, {
    "function-calc-no-invalid": true,
})

const FIXTURES_ROOT = path.join(__dirname, "fixtures")
const tests = listupFixtures(FIXTURES_ROOT)

describe("stylelint", () => {
    it("try", () => {
        const stylus = `
.a
  transformm scale(0.5)
`

        return stylelint
            .lint({
                code: stylus,
                customSyntax: postcssStylPath,
                config,
            })
            .then(result => {
                assert.deepStrictEqual(result.results.length, 1)
                assert.deepStrictEqual(result.results[0].warnings, [
                    {
                        column: 3,
                        line: 3,
                        rule: "property-no-unknown",
                        severity: "error",
                        text:
                            'Unexpected unknown property "transformm" (property-no-unknown)',
                    },
                ])
            })
    })

    for (const name of tests) {
        it(`stylelint stylus ${name}`, () => {
            const stylus = read(path.join(FIXTURES_ROOT, `${name}/input.styl`))
            return stylelint
                .lint({
                    code: stylus,
                    customSyntax: postcssStylPath,
                    config,
                })
                .then(result => {
                    const actual = JSON.stringify(
                        result.results[0].warnings,
                        null,
                        2
                    )
                    try {
                        const expect = read(
                            path.join(FIXTURES_ROOT, `${name}/warnings.json`)
                        )
                        assert.deepStrictEqual(actual, expect)
                    } catch (e) {
                        writeFixture(
                            path.join(FIXTURES_ROOT, `${name}/warnings.json`),
                            actual
                        )
                        throw e
                    }
                })
        })
    }
})
