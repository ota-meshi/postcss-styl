"use strict"

const { tokensToRaws } = require("./token-utils")

/**
 * Parse for `{...}`
 */
module.exports = (sourceCode, start) => {
    const cursor = sourceCode.createScopeTokenCursor(start)
    let token = cursor.next()
    if (token.value !== "{") {
        throw new Error(`Unexpected token:${token.value}`)
    }
    const params = [token]

    let semicolon = false
    let endIndex = token.range[1] - 1

    token = cursor.next()

    while (token) {
        if (cursor.scopeLevel === 0) {
            if (token.value === ";") {
                // end
                semicolon = true
                endIndex = token.range[1] - 1
                break
            }
            // end
            break
        }

        endIndex = token.range[1] - 1

        params.push(token)

        token = cursor.next()
    }

    const expression = params.slice(1, -1)
    const raws = tokensToRaws(params)
    const rawsExpression = tokensToRaws(expression)

    return {
        params: raws.value,
        expression: rawsExpression.value,
        raw: {
            css: raws.raw,
            stylus: raws.stylus,
            semicolon,
            expression: rawsExpression.raw,
            stylusExpression: rawsExpression.stylus,
        },
        endIndex,
    }
}
