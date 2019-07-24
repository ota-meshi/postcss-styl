"use strict"

const PostcssTokenize = require("postcss/lib/tokenize")
const Input = require("postcss/lib/input")

/**
 * Tokenizer for Stylus.
 */
module.exports = class Tokenizer {
    /**
     * Initialize this tokenizer.
     */
    constructor(text) {
        this.text = text
        this.nextTokenOffset = 0

        const input = new Input(text)
        this.postcssTokenize = new PostcssTokenize(input, {
            ignoreErrors: true,
        })
    }

    /**
     * Commit the current token.
     */
    commitToken(type, length) {
        const start = this.nextTokenOffset
        const offset = start + length
        const value = this.text.slice(start, offset)

        const token = {
            type,
            value,
            range: [start, offset],
        }
        this.nextTokenOffset = offset
        return token
    }

    /**
     * Get the tokens.
     * @returns The tokens
     * @public
     */
    *tokens() {
        let token = null
        while ((token = this.postcssTokenize.nextToken())) {
            yield* this.processToken(token)
        }
    }

    *processToken(token) {
        const [type, text] = token
        yield* this[type](text)
    }

    *processInlineComment() {
        const after = this.text.slice(this.nextTokenOffset)

        const index = after.search(/\r\n|\r|\n/u)
        let newText = null
        if (index > -1) {
            yield this.commitToken("inline-comment", index)

            newText = after.slice(index)
        } else {
            yield this.commitToken("inline-comment", after.length)

            newText = ""
        }
        const input = new Input(newText)
        this.postcssTokenize = new PostcssTokenize(input, {
            ignoreErrors: true,
        })
    }

    *word(text) {
        const { length } = text
        const rePunctuatorOrEscapeOrLineComment = /[\\(){}[\],.;:=!]|\/\//gu
        let r = null
        let start = 0
        while ((r = rePunctuatorOrEscapeOrLineComment.exec(text))) {
            if (r[0] === "\\") {
                rePunctuatorOrEscapeOrLineComment.lastIndex++
                continue
            }
            const wordLength = r.index - start
            if (wordLength > 0) {
                yield this.commitToken("word", wordLength)
            }
            if (r[0] === "//") {
                yield* this.processInlineComment()
                return
            }
            yield this.commitToken("punctuator", 1)
            start = rePunctuatorOrEscapeOrLineComment.lastIndex
        }
        const wordLength = length - start
        if (wordLength > 0) {
            yield this.commitToken("word", wordLength)
        }
    }

    *"at-word"(text) {
        yield this.commitToken("word", text.length)
    }

    *string(text) {
        yield this.commitToken("string", text.length)
    }

    *comment(text) {
        yield this.commitToken("comment", text.length)
    }

    *space(text) {
        const { length } = text
        const reLineBrakes = /\r\n|\r|\n/gu
        let r = null
        let start = 0
        while ((r = reLineBrakes.exec(text))) {
            const spaceLength = r.index - start
            if (spaceLength > 0) {
                yield this.commitToken("whitespace", spaceLength)
            }
            yield this.commitToken(
                "linebreak",
                reLineBrakes.lastIndex - r.index
            )
            start = reLineBrakes.lastIndex
        }
        const spaceLength = length - start
        if (spaceLength > 0) {
            yield this.commitToken("whitespace", spaceLength)
        }
    }

    *brackets(text) {
        yield this.commitToken("punctuator", 1)
        yield this.commitToken("arguments", text.length - 2)
        yield this.commitToken("punctuator", 1)
    }

    *":"() {
        yield* this.punctuator()
    }

    *";"() {
        yield* this.punctuator()
    }

    *"{"() {
        yield* this.punctuator()
    }

    *"}"() {
        yield* this.punctuator()
    }

    *"("() {
        yield* this.punctuator()
    }

    *")"() {
        yield* this.punctuator()
    }

    *"["() {
        yield* this.punctuator()
    }

    *"]"() {
        yield* this.punctuator()
    }

    *punctuator() {
        yield this.commitToken("punctuator", 1)
    }
}
