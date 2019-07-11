"use strict"

module.exports = class Cursor {
    constructor(tokens, startIndex) {
        this.tokens = tokens
        this.startIndex = startIndex
    }

    // eslint-disable-next-line class-methods-use-this
    prevUntil() {
        // noop
    }

    // eslint-disable-next-line class-methods-use-this
    nextUntil() {
        // noop
    }

    prev() {
        const { tokens, curIndex } = this
        const prev = curIndex == null ? this.startIndex : curIndex - 1
        if (prev < 0) {
            return null
        }
        const token = tokens[prev]
        if (this.prevUntil(token)) {
            return null
        }
        this.curIndex = prev
        return (this.currToken = token)
    }

    next() {
        const { tokens, curIndex } = this
        const next = curIndex == null ? this.startIndex : curIndex + 1
        if (next >= tokens.length) {
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
