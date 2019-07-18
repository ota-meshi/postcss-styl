"use strict"

const assert = require("assert")
const path = require("path")
const fs = require("fs")
const autoprefixer = require("autoprefixer")
const postcss = require("postcss")
const read = require("../../utils/read")

const stylusPostcss = require("../../../lib")

const FIXTURES_ROOT = path.join(__dirname, "fixtures")
const tests = fs.readdirSync(FIXTURES_ROOT)

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
                syntax: stylusPostcss,
                from: "test.styl",
            })
            .then(result => {
                // check can parse
                assert.strictEqual(
                    typeof stylusPostcss.parse(result.css),
                    "object"
                )
            })
    })

    for (const name of tests) {
        it(`autoprefix stylus ${name}`, () => {
            const stylus = read(path.join(FIXTURES_ROOT, `${name}/input.styl`))
            return postcss([
                autoprefixer({
                    overrideBrowserslist: "ie 11 or last 4 version",
                }),
            ])
                .process(stylus, {
                    syntax: stylusPostcss,
                    from: `${name}/input.styl`,
                })
                .then(result => {
                    try {
                        const expect = read(
                            path.join(FIXTURES_ROOT, `${name}/autoprefix.styl`)
                        )
                        assert.deepStrictEqual(result.css, expect)
                    } catch (e) {
                        fs.writeFileSync(
                            path.join(FIXTURES_ROOT, `${name}/autoprefix.styl`),
                            result.css
                        )
                        throw e
                    }

                    // check can parse
                    assert.strictEqual(
                        typeof stylusPostcss.parse(result.css),
                        "object"
                    )
                })
        })

        it(`autoprefix css ${name}`, () => {
            const stylus = read(path.join(FIXTURES_ROOT, `${name}/input.css`))
            return postcss([
                autoprefixer({
                    overrideBrowserslist: "ie 11 or last 4 version",
                }),
            ])
                .process(stylus, {
                    syntax: stylusPostcss,
                    from: `${name}/input.styl`,
                })
                .then(result => {
                    try {
                        const expect = read(
                            path.join(FIXTURES_ROOT, `${name}/autoprefix.css`)
                        )
                        assert.deepStrictEqual(result.css, expect)
                    } catch (e) {
                        fs.writeFileSync(
                            path.join(FIXTURES_ROOT, `${name}/autoprefix.css`),
                            result.css
                        )
                        throw e
                    }

                    // check can parse
                    assert.strictEqual(
                        typeof stylusPostcss.parse(result.css),
                        "object"
                    )
                })
        })
    }
})
