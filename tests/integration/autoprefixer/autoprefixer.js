"use strict"

const assert = require("assert")
const path = require("path")
const autoprefixer = require("autoprefixer")
const postcss = require("postcss")
const { writeFixture, listupFixtures } = require("../../utils")

const postcssStyl = require("postcss-styl")

const tests = listupFixtures(path.join(__dirname, "fixtures"))

describe("autoprefixer", () => {
    it("try", () => {
        const stylus = `
.a
  transform scale(0.5)
`
        return postcss([
            autoprefixer({ overrideBrowserslist: "ie 11 or last 4 version" }),
        ])
            .process(stylus, {
                syntax: postcssStyl,
                from: "test.styl",
            })
            .then(result => {
                assert.strictEqual(
                    result.css,
                    `
.a
  -webkit-transform scale(0.5);
  -ms-transform scale(0.5);
  transform scale(0.5)
`,
                )
                // check can parse
                assert.strictEqual(
                    typeof postcssStyl.parse(result.css),
                    "object",
                )
            })
    })

    for (const fixture of tests) {
        it(`autoprefix stylus ${fixture.name}`, () => {
            const stylus = fixture.contents["input.styl"]
            return postcss([
                autoprefixer({
                    overrideBrowserslist: "ie 11 or last 4 version",
                }),
            ])
                .process(stylus, {
                    syntax: postcssStyl,
                    from: `${fixture.name}/input.styl`,
                })
                .then(result => {
                    try {
                        const expect = fixture.contents["autoprefix.styl"]
                        assert.deepStrictEqual(result.css, expect)
                    } catch (e) {
                        writeFixture(
                            fixture.files["autoprefix.styl"],
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

        it(`autoprefix css ${fixture.name}`, () => {
            const stylus = fixture.contents["input.css"]
            return postcss([
                autoprefixer({
                    overrideBrowserslist: "ie 11 or last 4 version",
                }),
            ])
                .process(stylus, {
                    syntax: postcssStyl,
                    from: `${fixture.name}/input.styl`,
                })
                .then(result => {
                    try {
                        const expect = fixture.contents["autoprefix.css"]
                        assert.deepStrictEqual(result.css, expect)
                    } catch (e) {
                        writeFixture(
                            fixture.files["autoprefix.css"],
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
