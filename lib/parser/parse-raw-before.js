"use strict"

const Tokenizer = require("./tokenizer")
const { tokensToRaw } = require("./tokens-to-raw")

module.exports = (sourceCode, start, end) => {
    const { text } = sourceCode
    const tokenizer = new Tokenizer(
        text,
        start,
        end != null ? end : text.length - 1
    )
    let token = tokenizer.nextToken()

    const before = []
    let endIndex = start

    while (token && isRawToken(token)) {
        before.push(token)
        endIndex = token.range[1] - 1
        token = tokenizer.nextToken()
    }

    const raw = tokensToRaw(before)

    return {
        before: raw.raw,
        beforeStylus: raw.stylus,
        endIndex,
    }
}

/**
 * Chechs if raw target token
 * @param {*} token token
 */
function isRawToken(token) {
    return (
        token &&
        (token.type === "whitespace" ||
            token.type === "comment" ||
            token.type === "inline-comment" ||
            token.type === "linebreak")
    )
}
