"use strict"

const { tokensToRaws, isSkipToken } = require("./token-utils")

module.exports = (sourceCode, start, end) => {
    const cursor = sourceCode.createTokenCursor(start, {
        endLocationIndex: end,
    })

    const inlineComments = []
    const before = []

    let token = cursor.next()
    let endIndex = token ? token.range[0] - 1 : start
    while (token && isSkipToken(token)) {
        if (token.type === "inline-comment") {
            const raws = tokensToRaws(before)
            inlineComments.push({
                token,
                before: raws.raw,
                stylusBefore: raws.stylus,
            })
            before.length = 0
        } else {
            before.push(token)
            endIndex = token.range[1] - 1
        }
        token = cursor.next()
    }

    const raws = tokensToRaws(before)

    return {
        before: raws.raw,
        stylusBefore: raws.stylus,
        endIndex,
        inlineComments,
    }
}
