"use strict"

/**
 * remove inline comments
 * @param {string} s string
 */
function removeInlineComments(s, options) {
    return s.replace(
        /\/\/(?:[\s\S]*?)(?:\r\n|[\r\n])/gu,
        options.skipComment ? "" : " "
    ) // replace inline comments
}

const textExtractor = {
    *getNodesTexts(sourceCode, nodes, options) {
        let prev = null
        for (const node of nodes) {
            if (prev) {
                const prevAfterIndex = sourceCode.getEndIndex(prev) + 1
                const nextStartIndex = sourceCode.getStartIndex(node)
                if (prevAfterIndex < nextStartIndex) {
                    yield removeInlineComments(
                        sourceCode.text.slice(prevAfterIndex, nextStartIndex),
                        options
                    )
                }
            }
            yield* this.getTexts(sourceCode, node, options)
            prev = node
        }
    },
    *getTexts(sourceCode, node, options) {
        if (this[node.nodeName]) {
            yield* this[node.nodeName](sourceCode, node, options)
        } else {
            throw new Error(`Unimpl node: ${node.nodeName}`)
        }
    },
    *literal(sourceCode, node, options) {
        if (typeof node.val === "string") {
            yield node.val
        } else {
            yield* this.getTexts(sourceCode, node.val, options)
        }
    },
    *ident(_sourceCode, node, _options) {
        if (node.property) {
            // `@${node.string}`
            yield `@${node.string}`
        } else {
            yield node.string
        }
    },
    *comment(sourceCode, node, options) {
        if (options.skipComment) {
            return
        }
        yield sourceCode.getText(node, sourceCode.getEndIndex(node))
    },
    *unaryop(sourceCode, node, options) {
        yield node.op
        const opAfterIndex = sourceCode.getStartIndex(node) + node.op.length
        const exprStartIndex = sourceCode.getStartIndex(node.expr)
        if (opAfterIndex < exprStartIndex) {
            yield removeInlineComments(
                sourceCode.text.slice(opAfterIndex, exprStartIndex),
                options
            )
        }

        yield* this.getTexts(sourceCode, node.expr, options)
    },
    *binop(sourceCode, node, options) {
        yield* this.getTexts(sourceCode, node.left, options)

        const between = sourceCode.getText(
            sourceCode.getEndIndex(node.left) + 1,
            sourceCode.getStartIndex(node.right) - 1
        )

        let before = between
        const { op } = node
        let after = ""
        let comment = false
        for (let index = 0; index < between.length; index++) {
            const c = between[index]
            if (comment && (c === "\n" || c === "\r")) {
                comment = false
            } else if (c === "/" && between[index + 1] === "/") {
                comment = true
            } else if (between.startsWith(node.op, index)) {
                before = between.slice(0, index)
                after = between.slice(index + op.length)
                break
            }
        }
        if (before) {
            yield before
        }
        yield op
        if (after) {
            yield after
        }

        yield* this.getTexts(sourceCode, node.right, options)
    },
    *unit(_sourceCode, node, _options) {
        if (node.raw != null) {
            yield node.raw
        } else {
            yield `${node.val}`
        }
    },
    *rgba(_sourceCode, node, _options) {
        yield node.raw
    },
    *string(_sourceCode, node, _options) {
        yield `${node.quote}${node.string}${node.quote}`
    },
    *querylist(sourceCode, node, options) {
        yield* this.getNodesTexts(sourceCode, node.nodes, options)
    },
    *query(sourceCode, node, options) {
        yield* this.getNodesTexts(sourceCode, node.nodes, options)
    },
    *feature(sourceCode, node, options) {
        yield* this.getTexts(sourceCode, node.expr, options)
    },
    *expression(sourceCode, node, options) {
        yield* this.getNodesTexts(sourceCode, node.nodes, options)
    },
    *call(sourceCode, node, options) {
        yield node.name
        const nameAfterIndex = sourceCode.getStartIndex(node) + node.name.length
        const argsBeforeIndex = sourceCode.getStartIndex(node.args) - 1

        if (nameAfterIndex <= argsBeforeIndex) {
            yield removeInlineComments(
                sourceCode.getText(nameAfterIndex, argsBeforeIndex),
                options
            )
        }

        yield* this.getTexts(sourceCode, node.args, options)
    },
    *arguments(sourceCode, node, options) {
        const argsStartIndex = sourceCode.getStartIndex(node)
        const argsEndIndex = sourceCode.getEndIndex(node)
        if (node.isEmpty) {
            yield sourceCode.getText(argsStartIndex, argsEndIndex)
            return
        }
        const firstArgBeforeIndex = sourceCode.getStartIndex(node.nodes[0]) - 1
        if (argsStartIndex <= firstArgBeforeIndex) {
            yield removeInlineComments(
                sourceCode.getText(argsStartIndex, firstArgBeforeIndex),
                options
            )
        }
        yield* this.getNodesTexts(sourceCode, node.nodes, options)

        const lastArgAfterIndex =
            sourceCode.getEndIndex(node.nodes[node.nodes.length - 1]) + 1
        if (lastArgAfterIndex <= argsEndIndex) {
            yield removeInlineComments(
                sourceCode.getText(lastArgAfterIndex, argsEndIndex),
                options
            )
        }
    },
}

module.exports = {
    *extractTexts(sourceCode, nodes, { skipComment = false } = {}) {
        yield* textExtractor.getNodesTexts(sourceCode, nodes, { skipComment })
    },
    extractText(sourceCode, node, { skipComment = false } = {}) {
        let result = ""
        for (const t of textExtractor.getTexts(sourceCode, node, {
            skipComment,
        })) {
            result += t
        }
        return result
    },
}
