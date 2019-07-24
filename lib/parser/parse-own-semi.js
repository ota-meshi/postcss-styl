"use strict"

const { isWhitespaceToken } = require("./token-utils")

/**
 * Extract own semicolon tokens
 * @param {*} sourceCode
 * @param {*} start
 */
function extractTokens(sourceCode, start) {
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
        if (token.value === ";") {
            return [...spaces, token]
        }
        break
    }
    return []
}

module.exports = (sourceCode, start) => {
    const tokens = extractTokens(sourceCode, start)

    return {
        ownSemicolon: tokens.map(t => t.value).join(""),
    }
}
