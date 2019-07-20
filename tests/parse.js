"use strict"

const assert = require("assert")
const cases = require("postcss-parser-tests")
const path = require("path")

const parse = require("..").parse
const { listupFixtures, writeFixture, isExistFile } = require("./utils")

/**
 * Replacer
 * @param {*} key
 * @param {*} value
 */
function cleanReplacer(key, value) {
    if (key === "endChildren" || key === "startChildren") {
        return undefined
    }
    return value
}

/**
 * jsonify
 * @param {*} node
 */
function jsonify(node) {
    const obj = JSON.parse(cases.jsonify(node))
    return JSON.stringify(obj, cleanReplacer, 2)
}

cases.each((name, css, json) => {
    if (
        name === "semicolons.css" ||
        name === "quotes.css" ||
        name === "prop.css" || // -> prop01
        name === "inside.css" || // -> inside01
        name === "ie-progid.css" ||
        name === "function.css" || // -> url01
        name === "extends.css" || // -> extends01
        name === "escape.css" || // -> escape01
        name === "custom-properties.css" || // -> custom-properties01
        name === "atrule-no-semicolon.css" || // -> atrule-no-semicolon01
        name === "apply.css" || // -> apply01
        false
    ) {
        // Parse error on Stylus
        return
    }
    if (name === "selector.css") {
        // There are differences in the specifications of the Stylus and CSS.
        return
    }
    if (name === "comments.css") {
        // Stylus can not calculate locations.
        return
    }

    it(`parses ${name}`, () => {
        const parsed = jsonify(
            parse(css, {
                from: path.join(
                    path.resolve(
                        require.resolve("postcss-parser-tests/package.json"),
                        "../"
                    ),
                    "cases",
                    name
                ),
            })
        )
        assert.strictEqual(parsed, json)
    })
})

const tests = listupFixtures(path.join(__dirname, "fixtures"))

describe("parse", () => {
    for (const fixture of tests) {
        if (isExistFile(fixture.files["parsed.json"])) {
            it(`parses ${fixture.name}`, () => {
                testParse(fixture)
            })
        } else {
            it(`parses error ${fixture.name}`, () => {
                testParseError(fixture)
            })
        }
    }
})

/**
 * test for parse
 * @param {*} fixture
 */
function testParse(fixture) {
    const stylus = fixture.contents["input.styl"]
    const root = parse(stylus, { from: `${fixture.name}/input.styl` })
    const actual = cases.jsonify(root)
    try {
        const expect = fixture.contents["parsed.json"]
        assert.deepStrictEqual(actual, expect)
    } catch (e) {
        writeFixture(fixture.files["parsed.json"], actual)
        throw e
    }
}

/**
 * test for parse error
 * @param {*} fixture
 */
function testParseError(fixture) {
    const stylus = fixture.contents["input.styl"]
    try {
        parse(stylus, { from: `${fixture.name}/input.styl` })
        assert.fail("Expected error but not error")
    } catch (actualError) {
        const actual = JSON.stringify(
            actualError,
            (key, value) => {
                if (key === "file") {
                    return undefined
                }
                return value
            },
            2
        )
        try {
            const expect = fixture.contents["error.json"]
            assert.deepStrictEqual(actual, expect)
        } catch (e) {
            writeFixture(fixture.files["error.json"], actual)
            throw e
        }
    }
}
