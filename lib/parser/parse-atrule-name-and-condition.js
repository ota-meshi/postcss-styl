"use strict"

const { tokensToRaws, isEndOfLineToken, isSkipToken } = require("./token-utils")

// eslint-disable-next-line complexity
module.exports = (sourceCode, start, maxEnd) => {
    const cursor = sourceCode.createScopeTokenCursor(start, {
        endLocationIndex: maxEnd,
    })
    let token = cursor.next()
    let endIndex = start
    while (token && !token.value.trim()) {
        token = cursor.next()
    }
    let name = null
    let identifier = null
    if (/^[^a-z-]/u.test(token.value)) {
        name = token.value.slice(1)
        identifier = token.value[0]
    } else {
        name = token.value
        identifier = ""
    }
    endIndex = token.range[1] - 1

    const afterName = []
    token = cursor.next()
    while (isSkipToken(token) && !isEndOfLineToken(token)) {
        afterName.push(token)
        endIndex = token.range[1] - 1
        token = cursor.next()
    }

    let comma = false
    const params = []
    const between = []
    let semicolon = false

    while (token) {
        if (cursor.scopeLevel === 0) {
            if (!comma && isEndOfLineToken(token)) {
                // end
                if (token.type === "linebreak") {
                    // between.push(token)
                    endIndex = token.range[0] - 1
                } else {
                    between.push(token)
                    endIndex = token.range[1] - 1
                }
                break
            }
            if (token.value === ";") {
                // end
                semicolon = true
                endIndex = token.range[1] - 1
                break
            }
            if (token.value === "{") {
                let end = true
                const paramsStackToken = token
                const betweenStacks = []
                token = cursor.next()
                while (token) {
                    if (isEndOfLineToken(token) || token.value === "}") {
                        break
                    }
                    if (!isSkipToken(token)) {
                        end = false
                        break
                    }
                    betweenStacks.push(token)
                    token = cursor.next()
                }
                if (end) {
                    // end
                    break
                }
                between.push(...betweenStacks)
                params.push(paramsStackToken)
            }
        }

        endIndex = token.range[1] - 1

        if (isSkipToken(token)) {
            between.push(token)
        } else {
            params.push(...between)
            between.length = 0

            params.push(token)

            comma = token.value === ","
        }
        token = cursor.next()
    }

    if (!params.length) {
        between.push(...afterName)
        afterName.length = 0
    } else {
        // TODO
        // endIndex = params[params.length - 1].range[1] - 1
    }

    const raws = tokensToRaws(params)
    const rawsBetween = tokensToRaws(between)
    const rawsAfterName = tokensToRaws(afterName)

    return {
        name,
        params: raws.value,
        raw: {
            afterName: rawsAfterName.raw,
            css: raws.raw,
            stylus: raws.stylus,
            between: rawsBetween.raw,
            stylusBetween: rawsBetween.stylus,
            semicolon,
            identifier,
        },
        endIndex,
    }
}
