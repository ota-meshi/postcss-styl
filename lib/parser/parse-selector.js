"use strict"

const Tokenizer = require("./tokenizer")
const { tokensToRaw } = require("./tokens-to-raw")

module.exports = (sourceCode, selectorLocations) => {
    const { text } = sourceCode
    const selectors = []
    const between = []
    if (selectorLocations.length > 0) {
        for (let index = 0; index < selectorLocations.length - 1; index++) {
            const selectorLocation = selectorLocations[index]
            const tokenizer = new Tokenizer(text, ...selectorLocation)
            selectors.push([...tokenizer.tokens()])
        }
        const index = selectorLocations.length - 1
        const selectorLocation = selectorLocations[index]
        const tokenizer = new Tokenizer(text, ...selectorLocation)
        const tokens = [...tokenizer.tokens()]
        while (tokens.length) {
            const token = tokens.pop()
            if (
                token.type === "whitespace" ||
                token.type === "comment" ||
                token.type === "inline-comment"
            ) {
                between.unshift(token)
            } else {
                tokens.push(token)
                break
            }
        }
        selectors.push([...tokens])
    }

    const raws = selectors.reduce(
        (r, arr) => {
            const { value, raw, stylus } = tokensToRaw(arr)
            r.value.push(value)
            r.raw.push(raw)
            r.stylus.push(stylus)
            return r
        },
        { value: [], raw: [], stylus: [] }
    )

    const rawsBetween = tokensToRaw(between)

    return {
        selector: joinComma(raws.value),
        raw: {
            css: joinComma(raws.raw),
            stylus: raws.stylus.join(""),
            between: rawsBetween.raw,
            betweenStylus: rawsBetween.stylus,
        },
    }
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
