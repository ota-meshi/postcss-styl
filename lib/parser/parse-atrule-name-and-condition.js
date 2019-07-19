"use strict"

const { tokensToRaw } = require("./tokens-to-raw")

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
                let end = true
                const paramsStackToken = token
                const betweenStacks = []
                token = cursor.next()
                while (token) {
                    if (isEndOfLineToken(token) || token.value === "}") {
                        break
                    }
                    if (!isSkipToken(token)) {
                        end = false
                        break
                    }
                    betweenStacks.push(token)
                    token = cursor.next()
                }
                if (end) {
                    // end
                    break
                }
                between.push(...betweenStacks)
                params.push(paramsStackToken)
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
            stylusBetween: rawsBetween.stylus,
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
