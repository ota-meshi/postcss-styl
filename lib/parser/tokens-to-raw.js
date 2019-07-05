"use strict"

module.exports = {
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
