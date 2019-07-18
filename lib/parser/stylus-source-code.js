"use strict"

const sortedLastIndex = require("lodash.sortedlastindex")
const stylus = require("./stylus")
const Tokenizer = require("./tokenizer")
const { getStartIndex } = require("./locations")
const tokenCursorFactory = require("./token-cursor/factory")

/**
 * @typedef {object} Lines
 * @property {string[]} lines lines
 * @property {number[]} lineStartIndices start indices of lines
 * @property {string} text source code
 */

/**
 * The source code split into lines according
 * @param {string} css source code
 * @returns {Lines} lines
 */
function extractLines(css) {
    const lines = []
    const lineStartIndices = [0]

    const lineEndingPattern = /\r\n|[\r\n]/gu
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
            `Index out of range (requested index ${index}, but source text has length ${
                text.length
            }).`
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
            `Line number out of range (line ${line} requested, but only ${
                lineStartIndices.length
            } lines present).`
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
    constructor(mappers = []) {
        this.mappers = mappers
        this.orgIndex = 0
        this.newIndex = 0
    }

    addMap(orgRange, newRange) {
        if (orgRange[0] === newRange[0] && orgRange[1] === newRange[1]) {
            return
        }
        this.mappers.push({
            org: orgRange,
            new: newRange,
        })
    }

    addOffset(start, end, newLength) {
        const orgLength = start - this.orgIndex
        const newStart = this.newIndex + orgLength
        const newEnd = newStart + newLength
        this.addMap([this.orgIndex, start], [this.newIndex, newStart])
        this.addMap([start, end], [newStart, newEnd])
        this.orgIndex = end
        this.newIndex = newEnd
    }

    commit() {
        this.addMap(
            [this.orgIndex, Number.MAX_SAFE_INTEGER],
            [this.newIndex, Number.MAX_SAFE_INTEGER]
        )
        this.map = new LocationMap(this.mappers.reverse())
        this.mappers = []
        this.orgIndex = 0
        this.newIndex = 0
    }

    remapIndex(index) {
        let idx = index
        for (const mapper of this.mappers) {
            if (mapper.new[0] <= idx && idx < mapper.new[1]) {
                const offset = idx - mapper.new[0]
                idx = Math.min(mapper.org[0] + offset, mapper.org[1] - 1)
                break
            }
        }
        if (this.map) {
            return this.map.remapIndex(idx)
        }
        return idx
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
            this._storeHackLocations()
        }
        try {
            this.node = parser.parse()
        } catch (error) {
            error.lineno = parser.lexer.lineno
            error.column = parser.lexer.column
            throw error
        }
        const tokenizer = new Tokenizer(this.text, 0, this.text.length - 1)
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

        return tokenCursorFactory(tokens, startIndex, options)
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

    /**
     * Returns the index of the first token in the array where predicate is true, and -1
     * otherwise.
     * @param {number} startLocationIndex The index of start position of text
     * @param {function} predicate find calls predicate once for each token of the array, in ascending
     * order, until it finds one where predicate returns true. If such an token is found,
     * findTokenIndex immediately returns that token index. Otherwise, findTokenIndex returns -1.
     * @returns {number} the tokens index
     */
    findTokenIndex(locationIndex, predicate) {
        const { tokens } = this
        for (
            let index = this.getTokenIndex(locationIndex);
            index < tokens.length;
            index++
        ) {
            if (predicate(tokens[index], index)) {
                return index
            }
        }
        return -1
    }

    getText(start, end) {
        if (end == null) {
            return this.text.slice(this.getIndex(start))
        }
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
        if (loc.lineno != null) {
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

    _storeHackLocations() {
        const locationMap = (this.locationMap = new LocationMap())

        // HACK!
        // eslint-disable-next-line require-jsdoc
        function comment(str, val, offset, s) {
            let inComment =
                s.lastIndexOf("/*", offset) > s.lastIndexOf("*/", offset)
            const commentIdx = s.lastIndexOf("//", offset)
            let i = s.lastIndexOf("\n", offset)
            let double = 0
            let single = 0

            if (~commentIdx && commentIdx > i) {
                while (i !== offset) {
                    if (s[i] === "'") {
                        if (single) {
                            single--
                        } else {
                            single++
                        }
                    }
                    if (s[i] === '"') {
                        if (double) {
                            double--
                        } else {
                            double++
                        }
                    }

                    if (s[i] === "/" && s[i + 1] === "/") {
                        inComment = !single && !double
                        break
                    }
                    ++i
                }
            }

            const newStr = inComment
                ? str
                : // eslint-disable-next-line require-unicode-regexp
                  val === "," && /^[,\t\n]+$/.test(str)
                    ? // eslint-disable-next-line require-unicode-regexp
                      str.replace(/\n/, "\r")
                    : `${val}\r`

            locationMap.addOffset(offset, offset + str.length, newStr.length)
            return newStr
        }

        // eslint-disable-next-line require-jsdoc
        function cr(str, offset) {
            locationMap.addOffset(offset, offset + str.length, 1)
            return "\n"
        }

        // eslint-disable-next-line require-jsdoc
        function lf(str, offset) {
            locationMap.addOffset(offset, offset + str.length, 1)
            return "\r"
        }

        let text = this.text

        // Remove UTF-8 BOM.
        if (text.charAt(0) === "\uFEFF") {
            text = text.slice(1)
            locationMap.addOffset(0, 1, 0)
            locationMap.commit()
        }
        // eslint-disable-next-line require-unicode-regexp
        text = text.replace(/\s+$/, cr)
        locationMap.commit()
        // eslint-disable-next-line require-unicode-regexp
        text = text.replace(/\r\n?/g, cr)
        locationMap.commit()
        // eslint-disable-next-line require-unicode-regexp
        text = text.replace(/\\ *\n/g, lf)
        locationMap.commit()
        text = text.replace(
            // eslint-disable-next-line require-unicode-regexp
            /([,(:](?!\/\/[^ ])) *(?:\/\/[^\n]*|\/\*.*?\*\/)?\n\s*/g,
            comment
        )
        locationMap.commit()
        // eslint-disable-next-line require-unicode-regexp
        text = text.replace(/\s*\n[ \t]*([,)])/g, comment)

        const linesInfo = extractLines(text)

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
