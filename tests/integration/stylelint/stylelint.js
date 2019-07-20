"use strict"

const assert = require("assert")
const path = require("path")
const stylelint = require("stylelint")
const stylelintConfig = require("stylelint-config-recommended")
const { writeFixture, listupFixtures } = require("../../utils")
const customSyntax = require.resolve("./custom-syntax")

const config = Object.assign({}, stylelintConfig)
config.rules = Object.assign({}, config.rules, {
    "function-calc-no-invalid": true,
})

const tests = listupFixtures(path.join(__dirname, "fixtures"))

describe("stylelint", () => {
    it("try", () => {
        const stylus = `
.a
  transformm scale(0.5)
`

        return stylelint
            .lint({
                code: stylus,
                codeFilename: "input.stylus",
                customSyntax,
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

    for (const fixture of tests) {
        it(`stylelint stylus ${fixture.name}`, () => {
            const fileName = fixture.findFileName("input.styl", "input.vue")
            const stylus = fixture.contents[fileName]
            return stylelint
                .lint({
                    code: stylus,
                    codeFilename: `${fixture.name}/${fileName}`,
                    customSyntax,
                    config,
                })
                .then(result => {
                    const actual = JSON.stringify(
                        result.results[0].warnings,
                        null,
                        2
                    )
                    try {
                        const expect = fixture.contents["warnings.json"]
                        assert.deepStrictEqual(actual, expect)
                    } catch (e) {
                        writeFixture(fixture.files["warnings.json"], actual)
                        throw e
                    }
                })
        })
    }
})
