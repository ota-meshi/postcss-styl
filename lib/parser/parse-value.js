"use strict"

const {
    tokensToRaws,
    tokensToRawCss,
    tokensToRawStylus,
    isEndOfLineToken,
    isSkipToken,
    isWhitespaceToken,
} = require("./token-utils")

/**
 * Extract value tokens
 * @param {*} sourceCode
 * @param {*} start
 */
function extractTokens(sourceCode, start, maxEnd, options) {
    const minEnd = (options && options.minEnd) || -1
    const withinObject = options && options.withinObject
    const cursor = sourceCode.createScopeTokenCursor(start, {
        endLocationIndex: maxEnd,
    })

    const tokens = []
    const spaces = []
    let semicolon = false
    let endIndex = start

    let comma = false

    let token = null
    while ((token = cursor.next())) {
        if (cursor.scopeLevel === 0) {
            if (minEnd <= token.range[0]) {
                if (!comma && isEndOfLineToken(token)) {
                    // end
                    if (token.type === "inline-comment") {
                        tokens.push(...spaces)
                        tokens.push(token)
                        endIndex = token.range[1] - 1
                    }
                    break
                }
                if (
                    (!withinObject && token.value === ";") ||
                    (withinObject && token.value === ",")
                ) {
                    // end
                    tokens.push(...spaces)
                    semicolon = true
                    endIndex = token.range[1] - 1

                    break
                }
                if (token.value === "}") {
                    // end
                    break
                }
            }
        }

        if (token.type === "whitespace") {
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

module.exports = (sourceCode, start, maxEnd, options) => {
    const valueTokens = extractTokens(sourceCode, start, maxEnd, options)
    let { tokens } = valueTokens
    let sep = null
    const valueStart = tokens.findIndex((t, i) => {
        if (isSkipToken(t)) {
            return false
        }
        if (!sep) {
            if (t.value === ":" || t.value === "=") {
                sep = t.value
                return false
            }
            if (
                t.value === "?" &&
                tokens[i + 1] &&
                tokens[i + 1].value === "="
            ) {
                sep = "?"
                return false
            }
        } else if ((sep === ":" || sep === "?") && t.value === "=") {
            sep += t.value
            return false
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
    if (sep !== ":") {
        if (!sep) {
            betweenCss = [":", ...between]
        } else {
            const seps = sep.split("")
            variable = true
            betweenCss = between
                .map(t => {
                    if (t.value === seps[0]) {
                        seps.shift()
                        return seps.length ? null : ":"
                    }
                    return t
                })
                .filter(s => Boolean(s))
        }
    }

    const raws = tokensToRaws(tokens)
    const rawsImportant = tokensToRaws(important)

    const { semicolon, endIndex } = valueTokens
    return {
        value: raws.value.replace(/\s+$/u, ""),
        important: Boolean(important.length),
        raw: {
            css: raws.raw,
            stylus: raws.stylus,
            between: tokensToRawCss(betweenCss),
            stylusBetween: tokensToRawStylus(between),
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
