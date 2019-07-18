"use strict"

const assert = require("assert")
const cases = require("postcss-parser-tests")
const path = require("path")

const parse = require("..").parse
const { read, listupFixtures, writeFixture, isExistFile } = require("./utils")

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

const FIXTURES_ROOT = path.join(__dirname, "fixtures")
const tests = listupFixtures(FIXTURES_ROOT)

describe("parse", () => {
    for (const name of tests) {
        const expectErrorFile = path.join(FIXTURES_ROOT, `${name}/error.json`)
        if (!isExistFile(expectErrorFile)) {
            it(`parses ${name}`, () => {
                testParse(name)
            })
        } else {
            it(`parses error ${name}`, () => {
                testParseError(name, expectErrorFile)
            })
        }
    }
})

/**
 * test for parse
 * @param {*} name
 */
function testParse(name) {
    const stylus = read(path.join(FIXTURES_ROOT, `${name}/input.styl`))
    const root = parse(stylus, { from: `${name}/input.styl` })
    const actual = cases.jsonify(root)
    try {
        const expect = read(path.join(FIXTURES_ROOT, `${name}/parsed.json`))
        assert.deepStrictEqual(actual, expect)
    } catch (e) {
        writeFixture(path.join(FIXTURES_ROOT, `${name}/parsed.json`), actual)
        throw e
    }
}

/**
 * test for parse error
 * @param {*} name
 * @param {*} expectErrorFile
 */
function testParseError(name, expectErrorFile) {
    const stylus = read(path.join(FIXTURES_ROOT, `${name}/input.styl`))
    try {
        parse(stylus, { from: `${name}/input.styl` })
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
            const expect = read(expectErrorFile)
            assert.deepStrictEqual(actual, expect)
        } catch (e) {
            writeFixture(expectErrorFile, actual)
            throw e
        }
    }
}
