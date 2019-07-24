"use strict"

const { tokensToRaws, isSkipToken } = require("./token-utils")

module.exports = (sourceCode, end, opt = {}) => {
    const options = Object.assign({ blockCommentIsRaw: true }, opt)
    const cursor = sourceCode.createBackwardTokenCursor(end)

    const after = []

    let token = cursor.next()
    let startIndex = token ? token.range[1] : end
    while (token && isRawToken(token, options)) {
        after.unshift(token)
        token = cursor.next()
    }

    const afterTokens = token ? stripStartLineComments(after) : after
    startIndex = afterTokens.length ? afterTokens[0].range[0] : startIndex

    const raws = tokensToRaws(afterTokens)

    return {
        after: raws.raw,
        stylusAfter: raws.stylus,
        startIndex,
    }
}

/**
 * Chechs if raw target token
 * @param {*} token token
 * @param {*} options options
 */
function isRawToken(token, options) {
    if (isSkipToken(token)) {
        if (options.blockCommentIsRaw) {
            return true
        }
        return token.type !== "comment"
    }
    return false
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
