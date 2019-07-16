"use strict"

const { tokensToRaw } = require("./tokens-to-raw")

const REQUIRED_PARAMS = {
    "@keyframes": true,
    "@media": true,
    "@import": true,
    "@require": true,
    "@charset": true,
    "@namespace": true,
    "@document": true,
    "@-moz-document": true,
    "@supports": true,
    "@extend": true,
    "@extends": true,
    "@block": true,
    if: true,
    unless: true,
    for: true,
}

// eslint-disable-next-line complexity
module.exports = (sourceCode, start, maxEnd) => {
    const cursor = sourceCode.createTokenCursor(start, {
        endLocationIndex: maxEnd,
        scope: true,
    })
    let token = cursor.next()
    let endIndex = start
    while (token && !token.value.trim()) {
        token = cursor.next()
    }
    let name = null
    let identifier = null
    if (/^[^a-z-]/u.test(token.value)) {
        name = token.value.slice(1)
        identifier = token.value[0]
    } else {
        name = token.value
        identifier = ""
    }
    endIndex = token.range[1] - 1

    // Check if `params` is a required atrule.
    const requiredParams = REQUIRED_PARAMS[identifier + name]

    const afterName = []
    token = cursor.next()
    while (isSkipToken(token) && !isEndOfLineToken(token)) {
        afterName.push(token)
        endIndex = token.range[1] - 1
        token = cursor.next()
    }

    let comma = false
    const params = []
    const between = []
    let semicolon = false

    while (token) {
        if (cursor.scopeLevel === 0) {
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
                if (!requiredParams || params.length) {
                    // end
                    break
                }
            }
        }

        endIndex = token.range[1] - 1

        if (isSkipToken(token)) {
            between.push(token)
        } else {
            params.push(...between)
            between.length = 0

            params.push(token)

            comma = token.value === ","
        }
        token = cursor.next()
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
            identifier,
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
