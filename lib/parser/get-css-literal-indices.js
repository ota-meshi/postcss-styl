"use strict"

module.exports = (sourceCode, cssLiteralNode) => {
    const startIndex = sourceCode.getIndex(cssLiteralNode)
    let startBraceIndex = startIndex
    for (const token of sourceCode.genTokens(startIndex)) {
        if (token.value === "{") {
            startBraceIndex = token.range[0]
            break
        }
    }
    const cursor = sourceCode.createScopeTokenCursor(startBraceIndex)
    let token = cursor.next()
    let lastToken = null
    while (token) {
        if (cursor.scopeLevel === 0 && lastToken && lastToken.value === "}") {
            return {
                start: startBraceIndex,
                end: lastToken.range[1] - 1,
            }
        }

        lastToken = token
        token = cursor.next()
    }
    return {
        start: startBraceIndex,
        end: sourceCode.text.length - 1,
    }
}
