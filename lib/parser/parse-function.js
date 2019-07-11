"use strict"

const { tokensToRaw } = require("./tokens-to-raw")
const parseAtRuleNameAndCondition = require("./parse-atrule-name-and-condition")

module.exports = (sourceCode, start, end) => {
    const {
        name,
        params,
        raw: {
            afterName,
            css,
            stylus,
            between,
            betweenStylus,
            semicolon,
            identifier,
        },
        endIndex,
    } = parseAtRuleNameAndCondition(sourceCode, start, end)

    const cursor = sourceCode.createTokenCursor(endIndex + 1, {
        endLocationIndex: end,
    })
    let token = cursor.next()
    const body = []
    let bodySemicolon = false
    let bodyEndIndex = endIndex

    while (token) {
        bodySemicolon = false

        if (token.value === ";") {
            bodySemicolon = true
        }
        bodyEndIndex = token.range[1] - 1

        body.push(token)

        token = cursor.next()
    }

    if (semicolon) {
        body.pop()
    }

    const raw = tokensToRaw(body)

    return {
        name,
        params,
        body: raw.value,
        raw: {
            afterName,
            css,
            stylus,
            between,
            betweenStylus,
            betweenSemicolon: semicolon,
            semicolon: bodySemicolon,
            identifier,
            body: {
                css: raw.raw,
                stylus: raw.stylus,
            },
        },
        endIndex: bodyEndIndex,
    }
}
