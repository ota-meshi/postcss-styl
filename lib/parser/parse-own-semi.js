"use strict"

const Tokenizer = require("./tokenizer")

/**
 * Extract own semicolon tokens
 * @param {*} sourceCode
 * @param {*} start
 */
function extractTokens(sourceCode, start) {
    const { text } = sourceCode

    if (text[start - 1] !== "}") {
        return []
    }
    const tokenizer = new Tokenizer(text, start, text.length - 1)
    let token = tokenizer.nextToken()
    const spaces = []
    while (token) {
        if (isWhitespaceToken(token)) {
            spaces.push(token)
            token = tokenizer.nextToken()
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

/**
 * Chechs if whitespace token
 * @param {*} token token
 */
function isWhitespaceToken(token) {
    return token && (token.type === "whitespace" || token.type === "linebreak")
}
