"use strict"

/**
 * Get location if given node is interpolation expression.
 * @param {object} sourceCode
 * @param {StylusNode} node
 */
function getInterpolationExpressionLocation(sourceCode, node) {
    let cursor = null
    if (node.isEmpty) {
        const startIndex = sourceCode.getIndexFromStylusNode(node)
        cursor = sourceCode.createTokenCursor(startIndex)
    } else {
        const first = node.nodes[0]
        const startIndex = sourceCode.getStartIndex(first)
        cursor = sourceCode.createTokenCursor(startIndex)
        cursor.prev() // skip first token
    }
    let token = null
    while ((token = cursor.prev())) {
        if (isSkipToken(token)) {
            continue
        }
        if (token.value !== "{") {
            // not interpolation
            return null
        }
        break
    }
    if (!token) {
        // not interpolation
        return null
    }

    const interpolationStartIndex = token.range[0]

    const expressionCursor = sourceCode.createTokenCursor(
        interpolationStartIndex,
        {
            scope: true,
        }
    )
    // skip brace
    expressionCursor.next()
    while ((token = expressionCursor.next())) {
        if (expressionCursor.scopeLevel === 1) {
            if (token.value === "}") {
                return {
                    start: interpolationStartIndex,
                    end: token.range[1] - 1,
                }
            }
        } else if (expressionCursor.scopeLevel === 0) {
            // unknown state
            break
        }
    }
    return null

    /**
     * Chechs if skip target token
     * @param {*} t token
     */
    function isSkipToken(t) {
        return t && (t.type === "whitespace" || t.type === "comment")
    }
}

const startIndexResolver = {
    getStartIndex(sourceCode, node) {
        const { nodeName } = node
        if (this[nodeName]) {
            return this[nodeName](sourceCode, node)
        }
        return sourceCode.getIndexFromStylusNode(node)
    },
    selector(sourceCode, node) {
        if (node.segments[0]) {
            return this.getStartIndex(sourceCode, node.segments[0])
        }
        return sourceCode.getIndexFromStylusNode(node)
    },
    property(sourceCode, node) {
        if (node.segments[0]) {
            return this.getStartIndex(sourceCode, node.segments[0])
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
            [node.once ? "@require" : "@import"],
            [true]
        )
    },
    extend(sourceCode, node) {
        return this._skipBefores(
            sourceCode,
            sourceCode.getIndexFromStylusNode(node),
            [value => value === "@extend" || value === "@extends"],
            [true]
        )
    },
    expression(sourceCode, node) {
        const interpolationLoc = getInterpolationExpressionLocation(
            sourceCode,
            node
        )
        if (interpolationLoc != null) {
            return interpolationLoc.start
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
    ternary(sourceCode, node) {
        return Math.min(
            this.getStartIndex(sourceCode, node.falseExpr),
            this.getStartIndex(sourceCode, node.trueExpr),
            this.getStartIndex(sourceCode, node.cond)
        )
    },
    member(sourceCode, node) {
        return this.getStartIndex(sourceCode, node.left)
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
    call(sourceCode, node) {
        const index = sourceCode.getTokenIndex(sourceCode.getIndex(node.args))
        return sourceCode.tokens[index].range[0]
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
    getStartIndex(sourceCode, node) {
        return startIndexResolver.getStartIndex(sourceCode, node)
    },
}
