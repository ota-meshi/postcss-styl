"use strict"

module.exports = class Cursor {
    constructor(tokens, startIndex, nextUntil) {
        this.tokens = tokens
        this.startIndex = startIndex
        this.nextUntil = nextUntil || Function.prototype
    }

    next() {
        const { tokens, curIndex } = this
        const next = curIndex == null ? this.startIndex : curIndex + 1
        if (next >= tokens.length || next < 0) {
            return null
        }
        const token = tokens[next]
        if (this.nextUntil(token)) {
            return null
        }
        this.curIndex = next
        return (this.currToken = token)
    }
}
