"use strict"

const { isSkipToken, isEndOfLineToken } = require("./token-utils")

module.exports = (sourceCode, selectorNode) => {
    const blockBeforeIndex = selectorNode.block.nodes[0]
        ? sourceCode.getIndex(selectorNode.block.nodes[0]) - 1
        : sourceCode.getIndex(selectorNode.block)
    const cursor = sourceCode.createScopeTokenCursor(
        sourceCode.getIndex(selectorNode),
        {
            endLocationIndex: blockBeforeIndex,
        },
    )
    let token = cursor.next()
    if (!token) {
        return blockBeforeIndex
    }
    let endIndex = token.range[1] - 1
    let comma = false
    while (token) {
        if (cursor.scopeLevel === 0) {
            if (!comma && isEndOfLineToken(token)) {
                // end
                if (token.type === "linebreak") {
                    // between.push(token)
                    return token.range[0] - 1
                }
                return token.range[1] - 1
            }
            if (token.value === "{") {
                endIndex = token.range[0] - 1
                let end = true
                token = cursor.next()
                while (token) {
                    if (isEndOfLineToken(token) || token.value === "}") {
                        break
                    }
                    if (!isSkipToken(token)) {
                        end = false
                        break
                    }
                    token = cursor.next()
                }
                if (end) {
                    // end
                    return endIndex
                }
            }
        }

        comma = token.value === ","
        endIndex = token.range[1] - 1
        token = cursor.next()
    }
    return endIndex
}
