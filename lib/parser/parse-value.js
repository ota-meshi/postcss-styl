"use strict"

const { tokensToRaw, tokensToCss, tokensToStylus } = require("./tokens-to-raw")

/**
 * Extract value tokens
 * @param {*} sourceCode
 * @param {*} start
 */
function extractTokens(sourceCode, start, maxEnd) {
    const cursor = sourceCode.createTokenCursor(start, {
        endLocationIndex: maxEnd,
        scope: true,
    })

    const tokens = []
    const spaces = []
    let semicolon = false
    let endIndex = start

    let comma = false

    let token = null
    while ((token = cursor.next())) {
        if (cursor.scopeLevel === 0) {
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

            comma = token.value === ","
        }
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

module.exports = (sourceCode, start, maxEnd) => {
    const valueTokens = extractTokens(sourceCode, start, maxEnd)
    let { tokens } = valueTokens
    let sep = null
    const valueStart = tokens.findIndex(t => {
        if (isSkipToken(t)) {
            return false
        }
        if (!sep) {
            if (t.value === ":" || t.value === "=") {
                sep = t.value
                return false
            }
        }
        return true
    })
    const between = tokens.slice(0, valueStart)
    tokens = tokens.slice(valueStart)

    const importantStart = findImportantIndex(tokens)
    const important = []
    if (importantStart != null) {
        important.push(...tokens.slice(importantStart))
        tokens = tokens.slice(0, importantStart)
    }

    let variable = false
    let betweenCss = between
    if (between.some(t => t.value === sep)) {
        if (sep === "=") {
            variable = true
            let replaced = false
            betweenCss = between.map(t => {
                if (!replaced && t.value === "=") {
                    replaced = true
                    return ":"
                }
                return t
            })
        }
    } else {
        betweenCss = [":", ...between]
    }

    const raw = tokensToRaw(tokens)
    const rawsImportant = tokensToRaw(important)

    const { semicolon, endIndex } = valueTokens
    return {
        value: raw.value.replace(/\s+$/u, ""),
        important: Boolean(important.length),
        raw: {
            css: raw.raw,
            stylus: raw.stylus,
            between: tokensToCss(betweenCss),
            betweenStylus: tokensToStylus(between),
            important:
                rawsImportant.stylus !== " !important"
                    ? rawsImportant.stylus
                    : undefined,
            semicolon,
        },
        endIndex,
        variable,
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
