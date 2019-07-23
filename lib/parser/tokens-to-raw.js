"use strict"

module.exports = {
    tokensToCss(tokens) {
        const rawCss = []
        for (const token of tokens) {
            if (typeof token === "string") {
                rawCss.push(token)
            } else if (token.type !== "inline-comment") {
                rawCss.push(token.value)
            }
        }
        return rawCss.join("")
    },
    tokensToStylus(tokens) {
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
    tokensToRaw(tokens) {
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
                }
            }
        }
        return {
            value: value.join(""),
            raw: rawCss.join(""),
            stylus: rawStylus.join(""),
        }
    },
}
