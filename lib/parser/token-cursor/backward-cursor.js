"use strict"

const Cursor = require("./cursor")

module.exports = class BackwardCursor extends Cursor {
    next() {
        const { tokens, curIndex } = this
        const next = curIndex == null ? this.startIndex : curIndex - 1
        if (next < 0) {
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
