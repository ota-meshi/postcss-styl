"use strict"

const { isSkipToken } = require("./token-utils")

/**
 * Extract prop name tokens
 * @param {*} sourceCode
 * @param {*} start
 */
function extractTokens(sourceCode, start) {
    const cursor = sourceCode.createScopeTokenCursor(start)
    let token = cursor.next()
    const tokens = []
    let endIndex = start

    while (token) {
        if (cursor.scopeLevel === 0) {
            if (isSkipToken(token)) {
                // end
                endIndex = token.range[0] - 1
                break
            }
            if (token.type === "string" && tokens.length > 0) {
                // end
                endIndex = token.range[0] - 1
                break
            }
            if (token.value === ".") {
                if (
                    tokens.length > 0 &&
                    tokens[tokens.length - 1].range[1] === token.range[0]
                ) {
                    // maybe member expression
                } else {
                    // end
                    endIndex = token.range[0] - 1
                    break
                }
            }
            if (
                token.value === ":" ||
                token.value === "=" ||
                token.value === "," ||
                token.value === "!" ||
                token.value === "}"
            ) {
                // end
                endIndex = token.range[0] - 1
                break
            }
        }

        tokens.push(token)
        endIndex = token.range[1] - 1

        token = cursor.next()
    }
    return {
        tokens,
        endIndex,
    }
}

module.exports = (sourceCode, start) => {
    const { tokens, endIndex } = extractTokens(sourceCode, start)

    return {
        prop: tokens.map((t) => t.value).join(""),
        raw: {},
        endIndex,
    }
}
