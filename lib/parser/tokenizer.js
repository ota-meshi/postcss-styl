"use strict"

const EOF = -1
const NULL = 0x00
const TAB = 0x09
const CR = 0x0d
const LF = 0x0a
const FF = 0x0c
const SPACE = 0x20
const DQUOTE = 0x22 // "
const SQUOTE = 0x27 // '
const LPAREN = 0x28 // (
const RPAREN = 0x29 // )
const STAR = 0x2a // *
const COMMA = 0x2c // ,
const DOT = 0x2e // .
const SLASH = 0x2f // /
const SEMI = 0x3b // ;
const LBRACKET = 0x5b // [
const BACKSLASH = 0x5c // \
const RBRACKET = 0x5d // ]
const LBRACE = 0x7b // {
const RBRACE = 0x7d // }

/**
 * checks whether the given char is punctuator.
 * @param cc char
 * @returns `true` if the given char is punctuator
 */
function isPunctuator(cc) {
    return (
        cc === LPAREN ||
        cc === LBRACE ||
        cc === LBRACKET ||
        cc === RPAREN ||
        cc === RBRACE ||
        cc === RBRACKET ||
        cc === COMMA ||
        cc === DOT ||
        cc === SEMI
    )
}

/**
 * checks whether the given char is quotes.
 * @param cc char
 * @returns `true` if the given char quotes
 */
function isQuotes(cc) {
    return cc === DQUOTE || cc === SQUOTE
}

/**
 * Check whether the char code is a whitespace.
 * @param cc The char code to check.
 * @returns `true` if the char code is a whitespace.
 */
function isWhitespace(cc) {
    return cc === TAB || cc === LF || cc === FF || cc === CR || cc === SPACE
}

/**
 * Tokenizer for Stylus.
 */
module.exports = class Tokenizer {
    /**
     * Initialize this tokenizer.
     */
    constructor(text, start, end) {
        this.text = text
        this.offset = start - 1
        this.end = end
        this.state = "SCAN"
        this.nextTokenOffset = start
        this.lastCode = NULL
    }

    /**
     * Get the tokens.
     * @returns The tokens
     * @public
     */
    *tokens() {
        let token = null
        while ((token = this.nextToken())) {
            yield token
        }
    }

    /**
     * Get the next token.
     * @returns The next token or null.
     * @public
     */
    nextToken() {
        while (this.token == null) {
            const cc = this.scan()
            this.state = this[this.state](cc) || "SCAN"
            if (cc === EOF && !this.rescan) {
                break
            }
        }

        const { token } = this
        this.token = null
        return token
    }

    /**
     * Scan the curr char code.
     * @returns The scan char code.
     * @private
     */
    scan() {
        if (this.rescan) {
            this.rescan = false
            return this.lastCode
        }
        return this.next()
    }

    /**
     * Consume the next char code.
     * @returns The consumed char code.
     * @private
     */
    next() {
        if (this.offset <= this.end) {
            this.offset++
        }

        if (this.offset > this.end) {
            return (this.lastCode = EOF)
        }

        return (this.lastCode = this.text.charCodeAt(this.offset))
    }

    /**
     * Rescan the next state with the current code.
     */
    back() {
        this.rescan = true
    }

    /**
     * Commit the current token.
     */
    commitToken(type, indexOffset = 0) {
        const start = this.nextTokenOffset
        const offset = this.offset + indexOffset + 1
        const value = this.text.slice(start, offset)

        this.token = {
            type,
            value,
            range: [start, offset],
        }
        this.nextTokenOffset = offset

        this.lastTokenType = type
    }

    /**
     * @param cc The current char code.
     * @returns The next state.
     */
    SCAN(cc) {
        if (isWhitespace(cc)) {
            return "WHITESPACE"
        }
        if (cc === DQUOTE) {
            return "DQUOTE"
        }
        if (cc === SQUOTE) {
            return "SQUOTE"
        }
        if (cc === SLASH) {
            return "SLASH"
        }
        if (isPunctuator(cc)) {
            this.commitToken("punctuator")
            return "SCAN"
        }
        if (cc === EOF) {
            return "SCAN"
        }
        return "WORD"
    }

    /* eslint-disable consistent-return, no-param-reassign */
    WORD(cc) {
        while (
            !isWhitespace(cc) &&
            !isPunctuator(cc) &&
            !isQuotes(cc) &&
            cc !== EOF
        ) {
            const next = this.next()
            if (cc === SLASH) {
                if (next === SLASH) {
                    this.commitToken("word", -2)
                    return "INLINE_COMMENT"
                } else if (next === STAR) {
                    this.commitToken("word", -2)
                    return "COMMENT"
                }
            }
            cc = next
        }
        this.commitToken("word", -1)
        this.back()
    }

    WHITESPACE(cc) {
        while (isWhitespace(cc)) {
            cc = this.next()
        }
        this.commitToken("whitespace", -1)
        this.back()
    }

    SLASH(cc) {
        if (cc === STAR) {
            return "COMMENT"
        }
        if (cc === SLASH) {
            return "INLINE_COMMENT"
        }
        this.commitToken("word", -1)
        this.back()
    }

    COMMENT(cc) {
        while (cc !== EOF) {
            if (cc === STAR) {
                cc = this.next()
                if (cc === SLASH) {
                    this.commitToken("comment")
                    return
                }
            }
            cc = this.next()
        }
        this.commitToken("comment", -1)
    }

    INLINE_COMMENT(cc) {
        while (cc !== EOF) {
            if (cc === LF || cc === FF) {
                this.commitToken("inline-comment", -1)
                return this.back()
            }
            if (cc === CR) {
                cc = this.next()
                if (cc === LF) {
                    this.commitToken("inline-comment", -1)
                    return this.back()
                }
                this.commitToken("inline-comment", -2)
                if (!isWhitespace(cc)) {
                    this.commitToken("whitespace", -1)
                }
                return this.back()
            }
            cc = this.next()
        }
        this.commitToken("inline-comment", -1)
    }

    DQUOTE(cc) {
        this.skipString(cc, DQUOTE)
    }

    SQUOTE(cc) {
        this.skipString(cc, SQUOTE)
    }

    /**
     * Skip string
     */
    skipString(cc, end) {
        while (cc !== EOF) {
            if (cc === BACKSLASH) {
                cc = this.next()
            } else if (cc === end) {
                this.commitToken("string")
                return
            }
            cc = this.next()
        }
        this.commitToken("string", -1)
    }
    /* eslint-enable consistent-return, no-param-reassign */
}
