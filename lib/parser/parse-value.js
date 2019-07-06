"use strict"

const Tokenizer = require("./tokenizer")
const { tokensToRaw } = require("./tokens-to-raw")

/* eslint-disable complexity */
/**
 * Extract value tokens
 * @param {*} sourceCode
 * @param {*} start
 */
function extractTokens(sourceCode, start) {
    /* eslint-enable complexity */
    const { text } = sourceCode
    const tokenizer = new Tokenizer(text, start, text.length - 1)
    let token = tokenizer.nextToken()
    const tokens = []
    const spaces = []
    let semicolon = false
    let endIndex = start

    const parenStack = []
    let comma = false
    while (token) {
        if (!parenStack.length) {
            if (!comma && isEndOfLineToken(token)) {
                // end
                tokens.push(...spaces)
                if (token.type === "linebreak") {
                    // between.push(token)
                    endIndex = token.range[0] - 1
                } else {
                    tokens.push(token)
                    endIndex = token.range[1] - 1
                }
                break
            }
            if (token.value === ";") {
                // end
                tokens.push(...spaces)
                semicolon = true
                endIndex = token.range[1] - 1

                break
            }
            if (token.value === "}") {
                // end
                endIndex =
                    (spaces.length ? spaces[0].range[0] : token.range[0]) - 1
                break
            }
        }

        if (isSkipToken(token)) {
            spaces.push(token)
        } else {
            tokens.push(...spaces)
            spaces.length = 0

            tokens.push(token)
            endIndex = token.range[1] - 1
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
    return {
        tokens,
        semicolon,
        endIndex,
    }
}

/**
 * Find `!important` index
 */
function findImportantIndex(tokens) {
    let index = tokens.length - 1
    for (; index >= 0; index--) {
        const token = tokens[index]
        if (isSkipToken(token)) {
            continue
        }
        if (token.value.toLowerCase() === "important") {
            break
        }
        return null
    }
    index--
    if (index < 0) {
        return null
    }
    for (; index >= 0; index--) {
        const token = tokens[index]
        if (isSkipToken(token)) {
            continue
        }
        if (token.value === "!") {
            break
        }
        return null
    }
    index--
    if (index < 0) {
        return null
    }
    for (; index >= 0; index--) {
        const token = tokens[index]
        if (isWhitespaceToken(token)) {
            continue
        }
        return index + 1
    }
    return 0
}

module.exports = (sourceCode, start) => {
    const valueTokens = extractTokens(sourceCode, start)
    let { tokens } = valueTokens
    const valueStart = tokens.findIndex(t => !isSkipToken(t) && t.value !== ":")
    const between = tokens.slice(0, valueStart)
    tokens = tokens.slice(valueStart)

    const importantStart = findImportantIndex(tokens)
    const important = []
    if (importantStart != null) {
        important.push(...tokens.slice(importantStart))
        tokens = tokens.slice(0, importantStart)
    }

    const raw = tokensToRaw(tokens)
    const rawsBetween = tokensToRaw(between)
    const rawsImportant = tokensToRaw(important)

    const { semicolon, endIndex } = valueTokens
    return {
        value: raw.value.replace(/\s+$/u, ""),
        important: Boolean(important.length),
        raw: {
            css: raw.raw,
            stylus: raw.stylus,
            between:
                (between.some(t => t.value === ":") ? "" : ":") +
                rawsBetween.raw,
            betweenStylus: rawsBetween.stylus,
            important:
                rawsImportant.stylus !== " !important"
                    ? rawsImportant.stylus
                    : undefined,
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
        isWhitespaceToken(token) ||
        (token && (token.type === "comment" || token.type === "inline-comment"))
    )
}

/**
 * Chechs if whitespace token
 * @param {*} token token
 */
function isWhitespaceToken(token) {
    return token && (token.type === "whitespace" || token.type === "linebreak")
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
