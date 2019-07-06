"use strict"

const endIndexResolver = {
    getEndIndex(sourceCode, node) {
        if (this[node.nodeName]) {
            return this[node.nodeName](sourceCode, node)
        }
        throw new Error(`Unimpl node: ${node.nodeName}`)
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
    ident(sourceCode, node) {
        if (node.property) {
            // `@${node.string}`
            return sourceCode.getIndex(node) + node.string.length
        }
        return sourceCode.getIndex(node) + node.string.length - 1
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
    unaryop(sourceCode, node) {
        return this.getEndIndex(sourceCode, node.expr)
    },
    binop(sourceCode, node) {
        return this.getEndIndex(sourceCode, node.right)
    },
    unit(sourceCode, node) {
        if (node.raw != null) {
            return sourceCode.getIndex(node) + node.raw.length - 1
        }
        return sourceCode.getIndex(node) + `${node.val}`.length - 1
    },
    rgba(sourceCode, node) {
        return sourceCode.getIndex(node) + node.raw.length - 1
    },
    string(sourceCode, node) {
        return (
            sourceCode.getIndex(node) +
            node.quote.length * 2 +
            node.string.length -
            1
        )
    },
    // media(sourceCode, node) {
    //     return this.getEndIndex(sourceCode, node.val)
    // },
    querylist(sourceCode, node) {
        const lastQuery = node.nodes[node.nodes.length - 1]
        return this.getEndIndex(sourceCode, lastQuery)
    },
    query(sourceCode, node) {
        const lastFeature = node.nodes[node.nodes.length - 1]
        return this.getEndIndex(sourceCode, lastFeature)
    },
    feature(sourceCode, node) {
        return this.getEndIndex(sourceCode, node.expr)
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
        return this.getEndIndex(sourceCode, node.args)
    },
    arguments(sourceCode, node) {
        const { text } = sourceCode
        if (node.isEmpty) {
            let endIndex = sourceCode.getIndexFromStylusNode(node) + 1
            while (text[endIndex] !== ")" && endIndex + 1 < text.length) {
                endIndex++
            }
            return endIndex
        }
        const argsEndIndex =
            this.getEndIndex(sourceCode, node.nodes[node.nodes.length - 1]) + 1
        let endIndex = argsEndIndex
        while (!text[endIndex].trim() && endIndex + 1 < text.length) {
            endIndex++
        }
        if (text[endIndex] === ")") {
            return endIndex
        }
        return argsEndIndex
    },
}

const startIndexResolver = {
    getStartIndex(sourceCode, node) {
        if (this[node.nodeName]) {
            return this[node.nodeName](sourceCode, node)
        }
        return sourceCode.getIndexFromStylusNode(node)
    },
    media(sourceCode, node) {
        return this.getStartIndex(sourceCode, node.val)
    },
    charset(sourceCode, node) {
        let idx = sourceCode.getIndexFromStylusNode(node)
        while (
            idx >= 0 &&
            sourceCode.getText(idx, idx + 7).toLowerCase() !== "@charset"
        ) {
            idx--
        }
        if (idx <= 0) {
            return 0
        }
        return idx
    },
    supports(sourceCode, node) {
        let idx = this.getStartIndex(sourceCode, node.condition)
        while (
            idx >= 0 &&
            sourceCode.getText(idx, idx + 8).toLowerCase() !== "@supports"
        ) {
            idx--
        }
        if (idx <= 0) {
            return 0
        }
        return idx
    },
    import(sourceCode, node) {
        let idx = this.getStartIndex(sourceCode, node.path)
        while (
            idx >= 0 &&
            sourceCode.getText(idx, idx + 6).toLowerCase() !== "@import"
        ) {
            idx--
        }
        if (idx <= 0) {
            return 0
        }
        return idx
    },
    unaryop(sourceCode, node) {
        const { op } = node
        let idx = sourceCode.getIndexFromStylusNode(node)
        while (
            idx >= 0 &&
            sourceCode.getText(idx, idx + op.length - 1) !== op
        ) {
            idx--
        }
        if (idx <= 0) {
            return 0
        }
        return idx
    },
    binop(sourceCode, node) {
        return this.getStartIndex(sourceCode, node.left)
    },
    call(sourceCode, node) {
        const { text } = sourceCode
        let start = Math.min(
            sourceCode.getIndexFromStylusNode(node),
            sourceCode.getIndexFromStylusNode(node.args)
        )
        while (!text.startsWith(node.name, start) && start >= 0) {
            start--
        }
        return start
    },
    expression(sourceCode, node) {
        if (node.isEmpty) {
            return sourceCode.getIndexFromStylusNode(node)
        }
        const first = node.nodes[0]
        return this.getStartIndex(sourceCode, first)
    },
    arguments(sourceCode, node) {
        const { text } = sourceCode
        let start = sourceCode.getIndexFromStylusNode(node)
        while (text[start] !== "(" && start < text.length) {
            start++
        }
        return start
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
