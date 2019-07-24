"use strict"

const { tokensToRaws } = require("./token-utils")
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
            stylusBetween,
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

    const raws = tokensToRaws(body)

    return {
        name,
        params,
        body: raws.value,
        raw: {
            afterName,
            css,
            stylus,
            between,
            stylusBetween,
            betweenSemicolon: semicolon,
            semicolon: bodySemicolon,
            identifier,
            body: {
                css: raws.raw,
                stylus: raws.stylus,
            },
        },
        endIndex: bodyEndIndex,
    }
}
