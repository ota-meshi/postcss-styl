"use strict"

const sortedLastIndex = require("lodash.sortedlastindex")
const diff = require("fast-diff")
const stylus = require("stylus")
const Tokenizer = require("./tokenizer")
const { getStartIndex } = require("./locations")
const cursors = require("./token-cursor/cursors")
const { getName } = require("./stylus-nodes")

/**
 * @typedef {object} Lines
 * @property {string[]} lines lines
 * @property {number[]} lineStartIndices start indices of lines
 * @property {string} text source code
 */

/**
 * The source code split into lines according
 * @param {string} css source code
 * @param {boolean} stylusMode is stylus lines
 * @returns {Lines} lines
 */
function extractLines(css, stylusMode) {
    const lines = []
    const lineStartIndices = [0]

    const lineEndingPattern = stylusMode ? /\r|\n/gu : /\r\n|\r|\n/gu
    let match = null

    while ((match = lineEndingPattern.exec(css))) {
        lines.push(
            css.slice(
                lineStartIndices[lineStartIndices.length - 1],
                match.index
            )
        )
        lineStartIndices.push(match.index + match[0].length)
    }
    lines.push(css.slice(lineStartIndices[lineStartIndices.length - 1]))

    return {
        lines,
        lineStartIndices,
        text: css,
    }
}

/**
 * Converts a source text index into a (line, column) pair.
 * @param {number} index The index
 * @param {object} context The context
 * @returns {Object} A {line, column} location object with a 1-indexed column
 */
function getLocFromIndex(index, { lines, lineStartIndices, text }) {
    if (index < 0 || index > text.length) {
        throw new RangeError(
            `Index out of range (requested index ${index}, but source text has length ${text.length}).`
        )
    }

    // For an argument of this.text.length, return the location one "spot" past the last character
    // of the file. If the last character is a linebreak, the location will be column 0 of the next
    // line; otherwise, the location will be in the next column on the same line.
    // See getIndexFromLoc for the motivation for this special case.
    if (index === text.length) {
        return {
            line: lines.length,
            column: lines[lines.length - 1].length + 1,
        }
    }

    // To figure out which line rangeIndex is on, determine the last index at which rangeIndex could
    // be inserted into lineIndices to keep the list sorted.
    const lineNumber = sortedLastIndex(lineStartIndices, index)

    return {
        line: lineNumber,
        column: index - lineStartIndices[lineNumber - 1] + 1,
    }
}

/**
 * Converts a (line, column) pair into a range index.
 * @param {number|object} loc The index or line/column location
 * @param {number} loc.line The line number of the location (1-indexed)
 * @param {number} loc.column The column number of the location (1-indexed)
 * @param {object} context The context
 * @returns {number} The range index of the location in the file.
 */
function getIndexFromLoc(loc, { lineStartIndices, text }) {
    const line = loc.line
    if (line <= 0) {
        throw new RangeError(
            `Line number out of range (line ${line} requested). Line numbers should be 1-based.`
        )
    }

    if (line > lineStartIndices.length) {
        throw new RangeError(
            `Line number out of range (line ${line} requested, but only ${lineStartIndices.length} lines present).`
        )
    }

    const lineStartIndex = lineStartIndices[line - 1]
    const lineEndIndex =
        line === lineStartIndices.length ? text.length : lineStartIndices[line]
    const positionIndex = lineStartIndex + loc.column - 1

    if (
        (line === lineStartIndices.length && positionIndex > lineEndIndex) ||
        (line < lineStartIndices.length && positionIndex >= lineEndIndex)
    ) {
        throw new RangeError(
            `Column number out of range (column ${
                loc.column
            } requested, but the length of line ${line} is ${lineEndIndex -
                lineStartIndex}).`
        )
    }

    return positionIndex
}

class LocationMap {
    constructor() {
        this.mappers = []
        this.orgIndex = 0
        this.newIndex = 0
        this.batchLengthOrg = 0
        this.batchLengthNew = 0
    }

    applyEq(text) {
        this.flush()
        const newEnd = this.newIndex + text.length
        const orgEnd = this.orgIndex + text.length
        this.addMap([this.orgIndex, orgEnd], [this.newIndex, newEnd])
        this.newIndex = newEnd
        this.orgIndex = orgEnd
    }

    applyIns(text) {
        this.batchLengthNew += text.length
    }

    applyDel(text) {
        this.batchLengthOrg += text.length
    }

    flush() {
        if (this.batchLengthNew || this.batchLengthOrg) {
            const newEnd = this.newIndex + this.batchLengthNew
            const orgEnd = this.orgIndex + this.batchLengthOrg
            this.addMap([this.orgIndex, orgEnd], [this.newIndex, newEnd])
            this.newIndex = newEnd
            this.orgIndex = orgEnd
            this.batchLengthOrg = 0
            this.batchLengthNew = 0
        }
    }

    addMap(orgRange, newRange) {
        if (orgRange[0] === newRange[0] && orgRange[1] === newRange[1]) {
            return
        }
        this.mappers.unshift({
            org: orgRange,
            new: newRange,
        })
    }

    remapIndex(index) {
        for (const mapper of this.mappers) {
            if (mapper.new[0] <= index && index < mapper.new[1]) {
                const offset = index - mapper.new[0]
                return Math.min(mapper.org[0] + offset, mapper.org[1] - 1)
            }
        }
        return index
    }
}

class SourceCode {
    constructor(text) {
        this.text = text
        const { lines, lineStartIndices } = extractLines(text)
        this.lines = lines
        this.lineStartIndices = lineStartIndices
    }

    parse() {
        const parser = new stylus.Parser(this.text, {
            cache: false,
            "cache limit": 0,
        })
        if (this.text !== parser.lexer.str) {
            // HACKed
            this._storeHackLocations(this.text, parser.lexer.str)
        }
        try {
            this.node = parser.parse()
        } catch (error) {
            error.lineno = parser.lexer.lineno
            error.column = parser.lexer.column
            throw error
        }
        const tokenizer = new Tokenizer(this.text)
        const tokens = (this.tokens = [])
        const tokenIndexMap = (this.tokenIndexMap = {})
        let tokenIndex = 0
        for (const token of tokenizer.tokens()) {
            tokens.push(token)
            tokenIndexMap[token.range[0]] = tokenIndex
            tokenIndexMap[token.range[1] - 1] = tokenIndex
            tokenIndex++
        }

        return this.node
    }

    /**
     * Gets the index of the token of the given text index.
     * @param {number} locationIndex the text location index
     * @returns {number} the index of the token
     */
    getTokenIndex(locationIndex) {
        const map = this.tokenIndexMap
        let idx = locationIndex
        while (idx >= 0) {
            const i = map[idx]
            if (i != null) {
                return i
            }
            idx--
        }
        return 0
    }

    /**
     * Generate the token cursor.
     * @param {number} startLocationIndex The index of start position of text
     * @param {object} [options] The options
     * @property {number} [endLocationIndex] The index of end position of text
     * @returns {object} the token cursor
     */
    createTokenCursor(startLocationIndex, options) {
        const { tokens } = this
        const startIndex = this.getTokenIndex(startLocationIndex)

        return cursors.forward(tokens, startIndex, options)
    }

    /**
     * Generate the scoped token cursor.
     * @param {number} startLocationIndex The index of start position of text
     * @param {object} [options] The options
     * @property {number} [endLocationIndex] The index of end position of text
     * @returns {object} the token cursor
     */
    createScopeTokenCursor(startLocationIndex, options) {
        const { tokens } = this
        const startIndex = this.getTokenIndex(startLocationIndex)

        return cursors.scope(tokens, startIndex, options)
    }

    /**
     * Generate the backword tokens cursor.
     * @param {number} startLocationIndex The index of start position of text
     * @param {object} [options] The options
     * @property {number} [startLocationIndex] The index of end position of text
     * @returns {object} the token cursor
     */
    createBackwardTokenCursor(endLocationIndex, options) {
        const { tokens } = this
        const endIndex = this.getTokenIndex(endLocationIndex)

        return cursors.backward(tokens, endIndex, options)
    }

    /**
     * Generate the tokens.
     * @param {number} startLocationIndex The index of start position of text
     * @param {number} [endLocationIndex] The index of end position of text
     * @returns {Iterator} the tokens iterator
     */
    *genTokens(startLocationIndex, endLocationIndex) {
        const cursor = this.createTokenCursor(startLocationIndex, {
            endLocationIndex,
        })
        let token = null
        while ((token = cursor.next())) {
            yield token
        }
    }

    getText(start, end) {
        return this.text.slice(this.getIndex(start), this.getIndex(end) + 1)
    }

    /**
     * Converts a source text index into a (line, column) pair.
     * @param {number|object} loc The index or line/column location
     * @returns {Object} A {line, column} location object with a 1-indexed column
     */
    getLoc(loc) {
        if (typeof loc === "number") {
            return getLocFromIndex(loc, this)
        }
        if (loc.line != null && loc.column != null) {
            return loc
        }
        return this.getLoc(this.getLocFromStylusNode(loc), this)
    }

    /**
     * Converts a (line, column) pair into a range index.
     * @param {number|object} loc The index or line/column location
     * @param {number} loc.line The line number of the location (1-indexed)
     * @param {number} loc.column The column number of the location (1-indexed)
     * @returns {number} The range index of the location in the file.
     */
    getIndex(loc) {
        if (typeof loc === "number") {
            return loc
        }
        if (loc.lineno != null || getName(loc) != null) {
            return this.getStartIndex(loc)
        }
        return getIndexFromLoc(loc, this)
    }

    getStartIndex(node) {
        return getStartIndex(this, node)
    }

    // eslint-disable-next-line class-methods-use-this
    getLocFromStylusNode(node) {
        return {
            line: node.lineno,
            column: node.column,
        }
    }

    getIndexFromStylusNode(node) {
        return this.getIndex(this.getLocFromStylusNode(node))
    }

    _storeHackLocations(original, hacked) {
        const locationMap = (this.locationMap = new LocationMap())

        const results = diff(original, hacked)
        for (const [op, text] of results) {
            switch (op) {
                case diff.INSERT:
                    locationMap.applyIns(text)
                    break
                case diff.DELETE:
                    locationMap.applyDel(text)
                    break
                case diff.EQUAL:
                    locationMap.applyEq(text)
                    break
                default:
                    throw new Error(`Unexpected fast-diff operation "${op}"`)
            }
        }
        locationMap.flush()

        const linesInfo = extractLines(hacked, true)

        this.getIndexFromStylusNode = node =>
            locationMap.remapIndex(
                getIndexFromLoc(
                    { line: node.lineno, column: node.column },
                    linesInfo
                )
            )

        this.getLocFromStylusNode = node =>
            this.getLoc(this.getIndexFromStylusNode(node))
    }
}

module.exports = SourceCode
