"use strict"

const Cursor = require("./cursor")
const ScopeCursor = require("./scope-cursor")

module.exports = (tokens, startIndex, options = {}) => {
    const cursor = options.scope
        ? new ScopeCursor(tokens, startIndex)
        : new Cursor(tokens, startIndex)

    if (options.endLocationIndex != null) {
        const { endLocationIndex } = options
        cursor.prevUntil = token => endLocationIndex > token.range[1]
        cursor.nextUntil = token => endLocationIndex < token.range[0]
    }

    return cursor
}
