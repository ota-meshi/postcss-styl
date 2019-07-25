"use strict"

const assert = require("assert")
const cases = require("postcss-parser-tests")
const path = require("path")

const parse = require("..").parse
const {
    listupFixtures,
    writeFixture,
    isExistFile,
    deleteFixture,
} = require("./utils")

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
        if (!isExistFile(fixture.files["error.json"])) {
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
    let root = null
    try {
        root = parse(stylus, { from: `${fixture.name}/input.styl` })
    } catch (parseError) {
        writeFixture(fixture.files["error.json"], stringifyError(parseError))
        deleteFixture(fixture.files["parsed.json"])
        deleteFixture(fixture.files["stringify.css"])
        throw parseError
    }
    const actual = cases.jsonify(root)
    try {
        const expect = fixture.contents["parsed.json"]
        assert.deepStrictEqual(actual, expect)
    } catch (e) {
        writeFixture(fixture.files["parsed.json"], actual, e)
    }

    // check each node properties
    checkProperties(root)

    // win style linebreaks
    const stylusWin = stylus.replace(/\r\n|\r|\n/gu, "\r\n")
    if (stylusWin !== stylus) {
        const rootWin = parse(stylusWin, { from: `${fixture.name}/input.styl` })
        const actualWin = cases.jsonify(rootWin)
        try {
            const expectWin = fixture.contents["parsed-win.json"]
            assert.deepStrictEqual(actualWin, expectWin)
        } catch (e) {
            writeFixture(fixture.files["parsed-win.json"], actualWin)
            throw e
        }
    }
}

/**
 * test for parse error
 * @param {*} fixture
 */
function testParseError(fixture) {
    const stylus = fixture.contents["input.styl"]
    let hasError = false
    try {
        parse(stylus, { from: `${fixture.name}/input.styl` })
    } catch (actualError) {
        hasError = true
        const actual = stringifyError(actualError)
        try {
            const expect = fixture.contents["error.json"]
            assert.deepStrictEqual(actual, expect)
        } catch (e) {
            writeFixture(fixture.files["error.json"], actual)
            throw e
        }
    }
    if (!hasError) {
        deleteFixture(fixture.files["error.json"])
        assert.fail("Expected error but not error")
    }
}

/**
 * Stringify Error
 * @param {*} error
 */
function stringifyError(error) {
    return JSON.stringify(
        error,
        (key, value) => {
            if (key === "file") {
                return undefined
            }
            return value
        },
        2
    )
}

const KNOWN_PROPS = {
    root: ["nodes"],
    atrule: [
        "nodes",
        "name",
        "params",
        // stylus
        "pythonic", // pythonic style (indentation-based)
        "omittedSemi", // omitted semi-colons
        "function", // function declaration
        "body", // function body
        "mixin", // mixin function declaration
        "call", // function call expression
        "callBlockMixin", // block mixin function call expression
        "expression", // expression
        "postfix", // postfix conditionals or postfix iteration
    ],
    rule: [
        "nodes",
        "selector",
        "lastEach",
        "indexes",
        // stylus
        "pythonic", // pythonic style (indentation-based)
    ],
    decl: [
        "prop",
        "value",
        "important",
        // stylus
        "omittedSemi", // omitted semi-colons
        "assignment", // assignment property
    ],
    comment: ["text"],
}

/**
 * Check properties
 * @param {*} error
 */
function checkProperties(node) {
    const knownProps = KNOWN_PROPS[node.type]
    if (!knownProps) {
        assert.fail(`Unexpected type \`${node.type}\``)
    }
    if (node.nodes) {
        for (const n of node.nodes) {
            checkProperties(n)
        }
    }
    const allKnownProps = [...knownProps, "type", "raws", "parent", "source"]
    for (const key of Object.keys(node).filter(
        k => !allKnownProps.includes(k)
    )) {
        assert.fail(`Unexpected property \`${key}\` on ${node.type}`)
    }
}
