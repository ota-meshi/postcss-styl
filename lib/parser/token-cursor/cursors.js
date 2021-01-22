"use strict"

const Cursor = require("./cursor")
const ScopeCursor = require("./scope-cursor")
const BackwardCursor = require("./backward-cursor")

module.exports = {
    forward(tokens, startIndex, options = {}) {
        const { endLocationIndex } = options
        return new Cursor(
            tokens,
            startIndex,
            endLocationIndex != null
                ? (token) => endLocationIndex < token.range[0]
                : undefined,
        )
    },
    backward(tokens, startIndex, options = {}) {
        const { startLocationIndex } = options
        return new BackwardCursor(
            tokens,
            startIndex,
            startLocationIndex != null
                ? (token) => startLocationIndex >= token.range[1]
                : undefined,
        )
    },
    scope(tokens, startIndex, options = {}) {
        const { endLocationIndex } = options
        return new ScopeCursor(
            tokens,
            startIndex,
            endLocationIndex != null
                ? (token) => endLocationIndex < token.range[0]
                : undefined,
        )
    },
}
