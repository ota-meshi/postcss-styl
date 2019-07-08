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
        let idx = this.getStartIndex(sourceCode, node.path)
        while (idx >= 0) {
            const text = sourceCode.getText(idx, idx + 7).toLowerCase()
            if (text === "@require" || text.startsWith("@import")) {
                break
            }
            idx--
        }
        if (idx <= 0) {
            return 0
        }
        return idx
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

    _skipBefores(sourceCode, base, words, lowers) {
        let idx =
            typeof base === "number"
                ? base
                : this.getStartIndex(sourceCode, base)
        for (let index = words.length - 1; index >= 0; index--) {
            const word = words[index]
            if (word != null) {
                idx -= word.length
                while (idx >= 0) {
                    const text = sourceCode.getText(idx, idx + word.length - 1)
                    if (
                        text === word ||
                        (lowers && lowers[index] && text.toLowerCase() === word)
                    ) {
                        break
                    }
                    idx--
                }
                if (idx <= 0) {
                    return 0
                }
            }
        }
        if (idx <= 0) {
            return 0
        }
        return idx
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
