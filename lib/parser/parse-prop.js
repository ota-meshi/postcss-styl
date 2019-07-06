"use strict"

const Tokenizer = require("./tokenizer")
// const { tokensToRaw } = require("./tokens-to-raw")

/**
 * Extract prop name tokens
 * @param {*} sourceCode
 * @param {*} start
 */
function extractTokens(sourceCode, start) {
    const { text } = sourceCode
    const tokenizer = new Tokenizer(text, start, text.length - 1)
    let token = tokenizer.nextToken()
    const tokens = []
    let endIndex = start

    const parenStack = []
    while (token) {
        if (!parenStack.length) {
            if (isSkipToken(token)) {
                // end
                endIndex = token.range[0] - 1
                break
            }
            if (token.type === "string") {
                // end
                endIndex = token.range[0] - 1
                break
            }
            if (
                token.value === ":" ||
                token.value === "=" ||
                token.value === "," ||
                token.value === "." ||
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
        if (token.value === "}" && parenStack[0] === "{") {
            parenStack.shift()
        } else if (token.value === "{") {
            parenStack.unshift(token.value)
        }
        token = tokenizer.nextToken()
    }
    return {
        tokens,
        endIndex,
    }
}

module.exports = (sourceCode, start) => {
    const { tokens, endIndex } = extractTokens(sourceCode, start)

    return {
        prop: tokens.map(t => t.value).join(""),
        raw: {},
        endIndex,
    }
}

/**
 * Chechs if skip target token
 * @param {*} token token
 */
function isSkipToken(token) {
    return (
        token &&
        (token.type === "comment" ||
            token.type === "inline-comment" ||
            token.type === "whitespace" ||
            token.type === "linebreak")
    )
}
