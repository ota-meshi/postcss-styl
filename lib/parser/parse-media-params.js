"use strict"

const { tokensToRaws } = require("./token-utils")
const Tokenizer = require("./tokenizer")
const cursors = require("./token-cursor/cursors")
const { isSkipToken } = require("./token-utils")

const START_FEATURE = 1
const FEATURE_NAME = 2
const AFTER_FEATURE_NAME = 3
const AFTER_COLON = 4
/**
 * Parse for `@media params`
 */
// eslint-disable-next-line complexity -- X(
module.exports = (sourceCode, start, end) => {
    const cursor = createScopeTokenCursorForMedia(sourceCode, start, end)
    let token = cursor.next()
    const tokens = []
    const cssTokens = []
    let feature = 0
    while (token) {
        if (feature) {
            if (token.value === ")" && cursor.scopeLevel === 1) {
                feature = 0 // end feature block
            } else if (feature === START_FEATURE) {
                if (!isSkipToken(token)) {
                    feature = FEATURE_NAME
                }
            } else if (feature === FEATURE_NAME) {
                if (token.value === ":" && cursor.scopeLevel === 1) {
                    feature = AFTER_COLON
                } else if (isSkipToken(token) && cursor.scopeLevel === 1) {
                    feature = AFTER_FEATURE_NAME
                }
            } else if (feature === AFTER_FEATURE_NAME) {
                if (!isSkipToken(token)) {
                    const afterTokens = []
                    let t = cssTokens.pop()
                    while (isSkipToken(t)) {
                        afterTokens.unshift(t)
                        t = cssTokens.pop()
                    }
                    cssTokens.push(t)
                    cssTokens.push(":") // Add colon
                    cssTokens.push(...afterTokens)
                    feature = AFTER_COLON
                }
            }
        } else if (token.value === "(" && cursor.scopeLevel === 0) {
            feature = START_FEATURE
        }
        tokens.push(token)
        cssTokens.push(token)
        token = cursor.next()
    }

    const raws = tokensToRaws(tokens)
    const cssRaws = tokensToRaws(cssTokens)

    return {
        params: cssRaws.value,
        raw: {
            value: cssRaws.value,
            raw: cssRaws.raw,
            stylus: raws.stylus,
        },
    }
}

/**
 * Create scope token cursor
 */
function createScopeTokenCursorForMedia(sourceCode, start, end) {
    const tokens = []
    for (const token of sourceCode.genTokens(start, end)) {
        if (token.type === "arguments") {
            tokens.push(...flattenArgsTokens(token.value))
        } else {
            tokens.push(token)
        }
    }

    return cursors.scope(tokens, 0)
}

/**
 * flatten tokens
 */
function* flattenArgsTokens(text) {
    for (const token of new Tokenizer(text).tokens()) {
        if (token.type === "arguments") {
            yield* flattenArgsTokens(token.value)
        } else {
            yield token
        }
    }
}
