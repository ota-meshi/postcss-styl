"use strict"

const { tokensToRaws } = require("./token-utils")

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
    const selectors = []
    let nextStartIndex = 0
    for (const selectorLocation of selectorLocations) {
        if (nextStartIndex > selectorLocation[1]) {
            continue
        }
        const selector = []
        const endIndex = selectorLocation[1]
        const cursor = sourceCode.createScopeTokenCursor(
            Math.max(selectorLocation[0], nextStartIndex)
        )

        let token = cursor.next()
        while (token) {
            if (endIndex < token.range[0] && cursor.scopeLevel === 0) {
                nextStartIndex = token.range[0]
                break
            }
            selector.push(token)
            token = cursor.next()
        }

        const str = selector
            .map(t => t.value)
            .join("")
            .trim()
        if (str === "," || str === "") {
            selectors[selectors.length - 1].push(...selector)
            continue
        }

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
