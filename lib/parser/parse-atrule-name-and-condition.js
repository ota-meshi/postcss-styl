"use strict"

const Tokenizer = require("./tokenizer")
const { tokensToRaw } = require("./tokens-to-raw")

// eslint-disable-next-line complexity
module.exports = (sourceCode, start) => {
    const { text } = sourceCode
    const tokenizer = new Tokenizer(text, start, text.length - 1)
    let token = tokenizer.nextToken()
    let endIndex = start
    while (token && !token.value.startsWith("@")) {
        token = tokenizer.nextToken()
    }
    const name = token.value.slice(1)
    endIndex = token.range[1] - 1

    const afterName = []
    token = tokenizer.nextToken()
    while (isSkipToken(token) && !isEndOfLineToken(token)) {
        afterName.push(token)
        endIndex = token.range[1] - 1
        token = tokenizer.nextToken()
    }

    const parenStack = []
    let comma = false
    const params = []
    const between = []
    let semicolon = false

    while (token) {
        if (!parenStack.length) {
            if (!comma && isEndOfLineToken(token)) {
                // end
                if (token.type === "linebreak") {
                    // between.push(token)
                    endIndex = token.range[0] - 1
                } else {
                    between.push(token)
                    endIndex = token.range[1] - 1
                }
                break
            }
            if (token.value === ";") {
                // end
                semicolon = true
                endIndex = token.range[1] - 1
                break
            }
            if (token.value === "{") {
                // end
                break
            }
        }
        endIndex = token.range[1] - 1

        if (isSkipToken(token)) {
            between.push(token)
        } else {
            params.push(...between)
            between.length = 0

            params.push(token)
            if (
                (token.value === ")" && parenStack[0] === "(") ||
                (token.value === "}" && parenStack[0] === "{") ||
                (token.value === "]" && parenStack[0] === "[")
            ) {
                parenStack.shift()
            } else if (
                token.value === "(" ||
                token.value === "{" ||
                token.value === "["
            ) {
                parenStack.unshift(token.value)
            } else {
                comma = token.value === ","
            }
        }
        token = tokenizer.nextToken()
    }

    if (!params.length) {
        between.push(...afterName)
        afterName.length = 0
    }

    const raw = tokensToRaw(params)
    const rawsBetween = tokensToRaw(between)
    const rawsAfterName = tokensToRaw(afterName)

    return {
        name,
        params: raw.value,
        raw: {
            afterName: rawsAfterName.raw,
            css: raw.raw,
            stylus: raw.stylus,
            between: rawsBetween.raw,
            betweenStylus: rawsBetween.stylus,
            semicolon,
        },
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
        (token.type === "whitespace" ||
            token.type === "comment" ||
            token.type === "inline-comment" ||
            token.type === "linebreak")
    )
}

/**
 * Chechs if end of line token
 * @param {*} token token
 */
function isEndOfLineToken(token) {
    return (
        !token || token.type === "inline-comment" || token.type === "linebreak"
    )
}
