"use strict"

/**
 * Replace inline comment to css comment
 * @param {*} token
 */
function replaceInlineComment(token) {
    return `/*${token.value.slice(2)}*/`
}

module.exports = {
    tokensToRawCss(tokens) {
        const rawCss = []
        for (const token of tokens) {
            if (typeof token === "string") {
                rawCss.push(token)
            } else if (token.type !== "inline-comment") {
                rawCss.push(token.value)
            } else {
                rawCss.push(replaceInlineComment(token))
            }
        }
        return rawCss.join("")
    },
    tokensToRawStylus(tokens) {
        const rawStylus = []
        for (const token of tokens) {
            if (typeof token === "string") {
                rawStylus.push(token)
            } else {
                rawStylus.push(token.value)
            }
        }
        return rawStylus.join("")
    },
    tokensToRaws(tokens) {
        const value = []
        const rawCss = []
        const rawStylus = []
        for (const token of tokens) {
            if (typeof token === "string") {
                rawStylus.push(token)
                rawCss.push(token)
                value.push(token)
            } else {
                rawStylus.push(token.value)
                if (token.type !== "inline-comment") {
                    rawCss.push(token.value)
                    if (token.type !== "comment") {
                        value.push(token.value)
                    }
                } else {
                    rawCss.push(replaceInlineComment(token))
                }
            }
        }
        return {
            value: value.join(""),
            raw: rawCss.join(""),
            stylus: rawStylus.join(""),
        }
    },
    isEndOfLineToken,
    isSkipToken,
    isWhitespaceToken,
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
        token && (token.type === "inline-comment" || token.type === "linebreak")
    )
}
