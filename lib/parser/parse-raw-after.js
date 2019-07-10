"use strict"

const { tokensToRaw } = require("./tokens-to-raw")

module.exports = (sourceCode, end, opt = {}) => {
    const options = Object.assign({ blockCommentIsRaw: true }, opt)
    const cursor = sourceCode.createTokenCursor(end)

    const after = []

    let token = cursor.prev()
    let startIndex = token.range[1]
    while (token && isRawToken(token, options)) {
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
 * @param {*} options options
 */
function isRawToken(token, options) {
    return (
        token &&
        (token.type === "whitespace" ||
            token.type === "linebreak" ||
            token.type === "inline-comment" ||
            (options.blockCommentIsRaw && token.type === "comment"))
    )
}
