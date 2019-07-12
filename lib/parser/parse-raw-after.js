"use strict"

const { tokensToRaw } = require("./tokens-to-raw")

module.exports = (sourceCode, end, opt = {}) => {
    const options = Object.assign({ blockCommentIsRaw: true }, opt)
    const cursor = sourceCode.createTokenCursor(end)

    const after = []

    let token = cursor.prev()
    let startIndex = token ? token.range[1] : end
    while (token && isRawToken(token, options)) {
        after.unshift(token)
        token = cursor.prev()
    }

    const afterTokens = token ? stripStartLineComments(after) : after
    startIndex = afterTokens.length ? afterTokens[0].range[0] : startIndex

    const raw = tokensToRaw(afterTokens)

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

/**
 * Get the first-line comments
 */
function stripStartLineComments(after) {
    // check first-line comments
    let hasComments = false
    for (let index = 0; index < after.length; index++) {
        const token = after[index]
        if (token.type === "inline-comment" || token.type === "comment") {
            hasComments = true
        } else if (token.type === "linebreak") {
            return hasComments ? after.slice(index) : after
        }
    }
    return hasComments ? [] : after
}
