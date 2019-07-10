"use strict"

const Tokenizer = require("./tokenizer")
const { tokensToRaw } = require("./tokens-to-raw")

module.exports = (sourceCode, end) => {
    const { text } = sourceCode

    let { line } = sourceCode.getLoc(end)
    let lineEndIndex = end

    const after = []
    let startIndex = end
    while (line > 0) {
        // TODO multiline block comment
        const lineStartIndex = sourceCode.getIndex({ line, column: 1 })
        const tokenizer = new Tokenizer(text, lineStartIndex, lineEndIndex)
        let flg = false
        for (const token of Array.from(tokenizer.tokens()).reverse()) {
            if (isRawToken(token)) {
                after.push(token)
                startIndex = token.range[0]
            } else {
                flg = true
                break
            }
        }
        if (flg) {
            break
        }
        lineEndIndex = lineStartIndex - 1
        line--
    }
    const raw = tokensToRaw(after.reverse())

    return {
        after: raw.raw,
        afterStylus: raw.stylus,
        startIndex,
    }
}

/**
 * Chechs if raw target token
 * @param {*} token token
 */
function isRawToken(token) {
    return (
        token &&
        (token.type === "whitespace" ||
            token.type === "comment" ||
            token.type === "inline-comment" ||
            token.type === "linebreak")
    )
}
