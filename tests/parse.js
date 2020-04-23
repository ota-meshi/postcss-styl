"use strict"

const assert = require("assert")
const cases = require("postcss-parser-tests")
const path = require("path")

const self = require("..")
const parse = self.parse
const {
    listupFixtures,
    writeFixture,
    isExistFile,
    deleteFixture,
} = require("./utils")

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
        const parsed = stringifyAST(
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
            describe(`parses ${fixture.name}`, () => {
                testParse(fixture)
            })
        } else {
            describe(`parses error ${fixture.name}`, () => {
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
    let parsed = null
    try {
        parsed = parse(stylus, { from: `${fixture.name}/input.styl` })
    } catch (parseError) {
        writeFixture(fixture.files["error.json"], stringifyError(parseError))
        deleteFixture(fixture.files["parsed.json"])
        deleteFixture(fixture.files["parsed-win.json"])
        deleteFixture(fixture.files["stringify.css"])
        deleteFixture(fixture.files["transform-omits.styl"])
        deleteFixture(fixture.files["transform-remraws.styl"])

        throw parseError
    }
    it("AST should be valid.", () => {
        const actual = stringifyStylusAST(parsed)
        try {
            const expect = fixture.contents["parsed.json"]
            assert.deepStrictEqual(actual, expect)
        } catch (e) {
            writeFixture(fixture.files["parsed.json"], actual, e)
        }
    })

    it("It should not have unknown properties.", () => {
        checkProperties(parsed)
    })
    it("Location should be valid.", () => {
        checkLocations(parsed)
    })

    it("AST should  be valid even for Windows style line breaks.", () => {
        // win style linebreaks
        const stylusWin = stylus.replace(/\r\n|\r|\n/gu, "\r\n")
        if (stylusWin !== stylus) {
            const rootWin = parse(stylusWin, {
                from: `${fixture.name}/input.styl`,
            })
            const actualWin = stringifyStylusAST(rootWin)
            try {
                const expectWin = fixture.contents["parsed-win.json"]
                assert.deepStrictEqual(actualWin, expectWin)
            } catch (e) {
                writeFixture(fixture.files["parsed-win.json"], actualWin)
                throw e
            }
        }
    })
}

/**
 * test for parse error
 * @param {*} fixture
 */
function testParseError(fixture) {
    const stylus = fixture.contents["input.styl"]
    it("Error messages should be valid.", () => {
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
    })
}

/**
 * jsonify
 * @param {*} node
 */
function stringifyAST(node) {
    const obj = JSON.parse(cases.jsonify(node))
    return JSON.stringify(
        obj,
        (key, value) => {
            if (
                key === "endChildren" ||
                key === "startChildren" ||
                key === "rawEnd" ||
                key === "lang" ||
                key === "syntax"
            ) {
                return undefined
            }
            return value
        },
        2
    )
}

/**
 * jsonify stylus
 * @param {*} rootNode
 */
function stringifyStylusAST(rootNode) {
    return JSON.stringify(
        clean(rootNode),
        (key, value) => {
            if (key === "syntax") {
                return value === self ? "ok" : "ng"
            }
            return value
        },
        2
    )

    /**
     * copy from node_modules/postcss-parser-tests/jsonify.js
     * @param {*} node
     */
    function clean(node) {
        if (node.source) {
            delete node.source.input.css
            delete node.source.input.hasBOM
            node.source.input.file = path.basename(node.source.input.file)
        }

        delete node.indexes
        delete node.lastEach
        delete node.rawCache

        if (node.nodes) {
            node.nodes = node.nodes.map(clean)
        }

        return node
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
        "mixin", // mixin function declaration
        "call", // function call expression
        "callBlockMixin", // block mixin function call expression
        "expression", // expression
        "postfix", // postfix conditionals or postfix iteration
        "cssLiteral", // @css literals
        "atblock", // @block
        "assignment", // @block assignment
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
        "conditional", // conditional assignment
    ],
    comment: ["text"],
}

/**
 * Check properties
 * @param {*} node
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

/**
 * Check locations
 * @param {*} parent
 */
function checkLocations(parent) {
    if (parent.nodes) {
        let prev = null
        for (const node of parent.nodes) {
            if (parent.source.start && !parent.postfix) {
                if (compareLoc(parent.source.start, node.source.start) > 0) {
                    assert.fail(
                        `Invalid start location: parent.source.start=${JSON.stringify(
                            parent.source.start
                        )}, node.source.start=${JSON.stringify(
                            node.source.start
                        )}, parent:[${parent}], node:[${node}]`
                    )
                }
            }
            if (prev) {
                if (compareLoc(prev.source.end, node.source.start) >= 0) {
                    assert.fail(
                        `Invalid nodes between location: prev.source.end=${JSON.stringify(
                            prev.source.end
                        )}, node.source.start=${JSON.stringify(
                            node.source.start
                        )}, prev:[${prev}], node:[${node}]`
                    )
                }
            }
            if (parent.source.end && !parent.postfix) {
                if (compareLoc(parent.source.end, node.source.end) < 0) {
                    assert.fail(
                        `Invalid end location: parent.source.end=${JSON.stringify(
                            parent.source.end
                        )}, node.source.end=${JSON.stringify(
                            node.source.end
                        )}, parent:[${parent}], node:[${node}]`
                    )
                }
            }
            checkLocations(node)
            prev = node
        }
    }
}

/**
 * compare locations
 */
function compareLoc(a, b) {
    if (a.line === b.line) {
        return a.column > b.column ? 1 : a.column < b.column ? -1 : 0
    }
    return a.line > b.line ? 1 : -1
}
