"use strict"

const { tokensToRaws, isSkipToken } = require("./token-utils")

module.exports = (sourceCode, selectorLocations) => {
    const selectors = getSelectors(sourceCode, selectorLocations)
    const between = []
    if (selectors.length > 0) {
        const tokens = selectors[selectors.length - 1]
        while (tokens.length) {
            const token = tokens.pop()
            if (
                token.type === "whitespace" ||
                token.type === "linebreak" ||
                token.type === "comment" ||
                token.type === "inline-comment"
            ) {
                between.unshift(token)
            } else {
                tokens.push(token)
                break
            }
        }
    }

    const raws = selectors.reduce(
        (r, arr) => {
            const { value, raw, stylus } = tokensToRaws(arr)
            r.value.push(value)
            r.raw.push(raw)
            r.stylus.push(stylus)
            return r
        },
        { value: [], raw: [], stylus: [] }
    )

    const rawsBetween = tokensToRaws(between)

    return {
        selector: joinComma(raws.value),
        raw: {
            css: joinComma(raws.raw),
            stylus: raws.stylus.join(""),
            between: rawsBetween.raw,
            stylusBetween: rawsBetween.stylus,
        },
    }
}

/**
 * Gets selector tokens list
 * @param {*} sourceCode
 * @param {*} selectorLocations
 */
function getSelectors(sourceCode, selectorLocations) {
    if (selectorLocations.length <= 0) {
        return []
    }
    const selectors = []
    const startIndex = selectorLocations[0][0]
    const endIndex = selectorLocations[selectorLocations.length - 1][1]

    const cursor = sourceCode.createScopeTokenCursor(startIndex, {
        endLocationIndex: endIndex,
    })

    let token = cursor.next()
    let selector = []
    let linebreak = false
    while (token) {
        if (token.value === "," && cursor.scopeLevel === 0) {
            selector.push(token)
            selectors.push(selector)
            selector = []
            linebreak = false
        } else if (
            token.type === "linebreak" &&
            cursor.scopeLevel === 0 &&
            selector.some(t => !isSkipToken(t))
        ) {
            selector.push(token)
            linebreak = true
        } else if (linebreak && !isSkipToken(token)) {
            selectors.push(selector)
            selector = []
            linebreak = false
            selector.push(token)
        } else {
            selector.push(token)
        }
        token = cursor.next()
    }
    if (selector.length > 0) {
        selectors.push(selector)
    }

    return selectors
}

/**
 * Joins with comma.
 * @param {*} selector selector
 */
function joinComma(selector) {
    return selector.reduce((r, t) => {
        if (!r || /,\s*$/u.test(r)) {
            return r + t
        }
        return `${r},${t}`
    }, "")
}
