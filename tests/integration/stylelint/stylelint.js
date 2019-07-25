"use strict"

const assert = require("assert")
const path = require("path")
const _ = require("lodash")
const stylelint = require("stylelint")
const stylelintConfig = require("stylelint-config-standard")
const { writeFixture, listupFixtures, isExistFile } = require("../../utils")
const customSyntax = require.resolve("./custom-syntax")

const baseConfig = Object.assign({}, stylelintConfig)
baseConfig.rules = Object.assign({}, baseConfig.rules, {
    "function-calc-no-invalid": true,

    // useless for the stylus
    "block-opening-brace-space-before": false,
    "block-closing-brace-newline-before": false,
    "declaration-block-trailing-semicolon": false,
    "selector-list-comma-newline-after": false,
    "selector-list-comma-space-before": false,
    "block-closing-brace-space-before": false,
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
                config: baseConfig,
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
        const fileName = fixture.findFileName("input.styl", "input.vue")
        const stylus = fixture.contents[fileName]
        let fixtureConfig = baseConfig
        if (isExistFile(fixture.files["config.json"])) {
            fixtureConfig = _.merge(
                {},
                baseConfig,
                JSON.parse(fixture.contents["config.json"])
            )
        }
        it(`stylelint stylus ${fixture.name}`, () =>
            stylelint
                .lint({
                    code: stylus,
                    codeFilename: `${fixture.name}/${fileName}`,
                    customSyntax,
                    config: fixtureConfig,
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
                }))
        it(`stylelint --fix stylus ${fixture.name}`, () =>
            stylelint
                .lint({
                    code: stylus,
                    codeFilename: `${fixture.name}/${fileName}`,
                    customSyntax,
                    config: fixtureConfig,
                    fix: true,
                })
                .then(result => {
                    const actual = result.output
                    const fixedFileName = `fixed${path.extname(fileName)}`
                    try {
                        const expect = fixture.contents[fixedFileName]
                        assert.deepStrictEqual(actual, expect)
                    } catch (e) {
                        writeFixture(fixture.files[fixedFileName], actual)
                        throw e
                    }
                }))
    }
})
