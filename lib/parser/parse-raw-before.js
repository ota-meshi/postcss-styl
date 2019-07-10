"use strict"

const { tokensToRaw } = require("./tokens-to-raw")

module.exports = (sourceCode, start, end) => {
    const cursor = sourceCode.createTokenCursor(start, end)

    const before = []

    let token = cursor.next()
    let endIndex = token ? token.range[0] - 1 : start
    while (token && isRawToken(token)) {
        before.push(token)
        endIndex = token.range[1] - 1
        token = cursor.next()
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
