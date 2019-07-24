"use strict"

const Cursor = require("./cursor")

const KIND_BRACKET = 1
const KIND_BRACE = 2
const KIND_PAREN = 3

const LEFT_PAREN_KINDS = {
    "(": KIND_PAREN,
    "{": KIND_BRACE,
    "[": KIND_BRACKET,
}

const RIGHT_PAREN_KINDS = {
    ")": KIND_PAREN,
    "}": KIND_BRACE,
    "]": KIND_BRACKET,
}

module.exports = class ScopeCursor extends Cursor {
    constructor(...args) {
        super(...args)
        this.scope = {
            level: 0,
            parenKind: 0,
        }
    }

    get scopeLevel() {
        return this.scope.level
    }

    next() {
        const { currToken } = this

        if (currToken) {
            if (RIGHT_PAREN_KINDS[currToken.value] === this.scope.parenKind) {
                this.scope = this.scope.parent
            } else if (LEFT_PAREN_KINDS[currToken.value]) {
                this.scope = {
                    parent: this.scope,
                    level: this.scope.level + 1,
                    parenKind: LEFT_PAREN_KINDS[currToken.value],
                }
            }
        }
        return super.next()
    }
}
