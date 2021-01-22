"use strict"

const { isWhitespaceToken } = require("./token-utils")

/**
 * Extract own semicolon tokens
 * @param {*} sourceCode
 * @param {*} start
 */
function extractTokens(sourceCode, start, { withinObject }) {
    const cursor = sourceCode.createTokenCursor(start - 1)
    let token = cursor.next()
    if (token.value !== "}") {
        return []
    }
    if (!isWhitespaceToken(token)) {
        token = cursor.next()
    }

    const spaces = []
    while (token) {
        if (isWhitespaceToken(token)) {
            spaces.push(token)
            token = cursor.next()
            continue
        }
        if (
            (!withinObject && token.value === ";") ||
            (withinObject && token.value === ",")
        ) {
            return [...spaces, token]
        }
        break
    }
    return []
}

module.exports = (sourceCode, start, { withinObject } = {}) => {
    const tokens = extractTokens(sourceCode, start, { withinObject })

    return {
        ownSemicolon: tokens.map((t) => t.value).join(""),
    }
}
