"use strict"

const endIndexResolver = {
    getEndIndex(sourceCode, node) {
        const { nodeName } = node
        if (this[nodeName]) {
            return this[nodeName](sourceCode, node)
        }

        console.log(
            `The getEndIndex of \`${nodeName}\` is not implemented yet.`
        )
        throw new Error(
            `The getEndIndex of \`${nodeName}\` is not implemented yet.`
        )
    },
    binop(sourceCode, node) {
        return this.getEndIndex(sourceCode, node.right)
    },
    literal(sourceCode, node) {
        if (typeof node.val === "string") {
            const { text } = sourceCode
            const nodeStart = sourceCode.getIndex(node)
            let start = nodeStart
            const len = node.val.length
            let end = start + len
            if (text.slice(start, end) === node.val) {
                return end - 1
            }
            if (!node.val.trim()) {
                // As the position of the blank may shift forward, adjust it.
                if (text.slice(start + 1, end + 1) === node.val) {
                    return end
                }
            }

            // As the position may shift backward with @media, adjust it.
            start--
            end = start + len
            while (start >= 0) {
                if (text.slice(start, end) === node.val) {
                    return end - 1
                }
                start--
                end = start + len
            }
            // fallback
            return nodeStart + len - 1
        }
        return this.getEndIndex(sourceCode, node.val)
    },
    comment(sourceCode, node) {
        let endIndex = sourceCode.getIndex(node) + node.str.length - 1
        const { text } = sourceCode
        while (
            (text[endIndex] !== "/" || text[endIndex - 1] !== "*") &&
            text.length > endIndex + 1
        ) {
            endIndex++
        }
        return endIndex
    },
    expression(sourceCode, node) {
        if (node.isEmpty) {
            const { text } = sourceCode
            const startIndex = sourceCode.getStartIndex(node)
            if (text[startIndex] !== "{") {
                // unknown?
                return startIndex
            }
            for (let index = startIndex + 1; index < text.length; index++) {
                if (text[index] === "}") {
                    return index
                }
            }
            // unknown?
            return startIndex
        }
        const last = node.nodes[node.nodes.length - 1]
        return this.getEndIndex(sourceCode, last)
    },
    call(sourceCode, node) {
        const { tokens } = sourceCode
        const parenTokenIndex = sourceCode.findTokenIndex(
            sourceCode.getIndexFromStylusNode(node),
            parenToken => parenToken.value === "("
        )
        if (parenTokenIndex >= 0) {
            const parenStack = []
            for (
                let index = parenTokenIndex + 1;
                index < tokens.length;
                index++
            ) {
                const token = tokens[index]

                if (!parenStack.length && token.value === ")") {
                    return token.range[1] - 1
                }

                if (
                    (token.value === ")" && parenStack[0] === "(") ||
                    (token.value === "}" && parenStack[0] === "{") ||
                    (token.value === "]" && parenStack[0] === "[")
                ) {
                    parenStack.shift()
                } else if (
                    token.value === "(" ||
                    token.value === "{" ||
                    token.value === "["
                ) {
                    parenStack.unshift(token.value)
                }
            }
        }
        return sourceCode.text.length - 1
    },
}

const startIndexResolver = {
    getStartIndex(sourceCode, node) {
        const { nodeName } = node
        if (this[nodeName]) {
            return this[nodeName](sourceCode, node)
        }
        return sourceCode.getIndexFromStylusNode(node)
    },
    media(sourceCode, node) {
        return this.getStartIndex(sourceCode, node.val)
    },
    charset(sourceCode, node) {
        return this._skipBefores(sourceCode, node.val, ["@charset"], [true])
    },
    supports(sourceCode, node) {
        return this._skipBefores(
            sourceCode,
            node.condition,
            ["@supports"],
            [true]
        )
    },
    import(sourceCode, node) {
        return this._skipBefores(
            sourceCode,
            node.path,
            [text => text === "@require" || text === "@import"],
            [true]
        )
    },
    expression(sourceCode, node) {
        if (node.isEmpty) {
            return sourceCode.getIndexFromStylusNode(node)
        }
        const first = node.nodes[0]
        return this.getStartIndex(sourceCode, first)
    },
    binop(sourceCode, node) {
        return this.getStartIndex(sourceCode, node.left)
    },
    ident(sourceCode, node) {
        if (node.val.nodeName === "function") {
            return this.getStartIndex(sourceCode, node.val)
        }
        return sourceCode.getIndexFromStylusNode(node)
    },
    each(sourceCode, node) {
        const { key, val } = node
        return this._skipBefores(
            sourceCode,
            node.expr,
            ["for", val, key, "in"],
            [true, false, false, true]
        )
    },
    if(sourceCode, node) {
        return this._skipBefores(
            sourceCode,
            node.cond,
            [node.negate ? "unless" : "if"],
            [true]
        )
    },

    _skipBefores(sourceCode, base, words, lowers) {
        const idx =
            typeof base === "number"
                ? base
                : this.getStartIndex(sourceCode, base)
        const cursor = sourceCode.createTokenCursor(idx)
        const wordsStack = [...words]
        const lowersStack = [...lowers]

        /**
         * next checker
         */
        function next() {
            let word = wordsStack.pop()
            let lower = lowersStack.pop()
            while (word == null) {
                if (!wordsStack.length) {
                    return null
                }
                word = wordsStack.pop()
                lower = lowersStack.pop()
            }
            if (lower) {
                return typeof word === "function"
                    ? value => word(value.toLowerCase())
                    : value => value.toLowerCase() === word
            }
            return typeof word === "function" ? word : value => value === word
        }

        let check = next()

        let token = null
        while ((token = cursor.prev())) {
            const { value } = token
            if (check(value)) {
                if ((check = next()) == null) {
                    return token.range[0]
                }
            }
        }
        return 0
    },
}

module.exports = {
    getEndIndex(sourceCode, node) {
        return endIndexResolver.getEndIndex(sourceCode, node)
    },
    getStartIndex(sourceCode, node) {
        return startIndexResolver.getStartIndex(sourceCode, node)
    },
}
