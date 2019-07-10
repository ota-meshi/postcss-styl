"use strict"

const { tokensToRaw } = require("./tokens-to-raw")

module.exports = (sourceCode, end) => {
    const cursor = sourceCode.createTokenCursor(end)

    const after = []
    let startIndex = end

    let token = cursor.prev()
    while (token && isRawToken(token)) {
        after.unshift(token)
        startIndex = token.range[0]
        token = cursor.prev()
    }

    const raw = tokensToRaw(after)

    return {
        after: raw.raw,
        afterStylus: raw.stylus,
        startIndex,
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
