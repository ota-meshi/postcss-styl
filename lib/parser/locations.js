"use strict"

const { isSkipToken, isEndOfLineToken } = require("./token-utils")
const { getName } = require("./stylus-nodes")

/**
 * Get location if given node is interpolation expression.
 * @param {object} sourceCode
 * @param {StylusNode} node
 */
function getInterpolationExpressionLocation(sourceCode, node) {
    let cursor = null
    if (node.isEmpty) {
        const startIndex = sourceCode.getIndexFromStylusNode(node)
        cursor = sourceCode.createBackwardTokenCursor(startIndex)
    } else {
        const first = node.nodes[0]
        const startIndex = sourceCode.getStartIndex(first)
        cursor = sourceCode.createBackwardTokenCursor(startIndex)
        cursor.next() // skip first token
    }
    let token = null
    while ((token = cursor.next())) {
        if (isSkipToken(token) && !isEndOfLineToken(token)) {
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

    const expressionCursor = sourceCode.createScopeTokenCursor(
        interpolationStartIndex,
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
}

const startIndexResolver = {
    getStartIndex(sourceCode, node) {
        const name = getName(node)
        if (this[name]) {
            return this[name](sourceCode, node)
        }
        return sourceCode.getIndexFromStylusNode(node)
    },
    group(sourceCode, node) {
        const index = sourceCode.getIndexFromStylusNode(node)

        const c = sourceCode.text[index]
        if (c === "}" || c === "{") {
            // The index may shift if the selector is next to the brace.
            const firstChild = node.nodes[0]
            if (
                firstChild &&
                getName(firstChild) === "selector" &&
                firstChild.column === node.column + 1 &&
                firstChild.line === node.line
            ) {
                return this.getStartIndex(sourceCode, firstChild)
            }
        }
        return index
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
            [true],
        )
    },
    import(sourceCode, node) {
        return this._skipBefores(
            sourceCode,
            node.path,
            [node.once ? "@require" : "@import"],
            [true],
        )
    },
    extend(sourceCode, node) {
        return this._skipBefores(
            sourceCode,
            sourceCode.getIndexFromStylusNode(node),
            [(value) => value === "@extend" || value === "@extends"],
            [true],
        )
    },
    expression(sourceCode, node) {
        const interpolationLoc = getInterpolationExpressionLocation(
            sourceCode,
            node,
        )
        if (interpolationLoc != null) {
            return interpolationLoc.start
        }
        const first = node.nodes[0]
        const startIndex = this.getStartIndex(sourceCode, first)

        // check paren
        const cursor = sourceCode.createBackwardTokenCursor(startIndex)
        cursor.next() // skip expr
        let token = cursor.next()
        while (token && isSkipToken(token)) {
            token = cursor.next()
        }
        if (token && token.value === "(") {
            return token.range[0]
        }

        return startIndex
    },
    binop(sourceCode, node) {
        return this.getStartIndex(sourceCode, node.left)
    },
    unaryop(sourceCode, node) {
        const startIndex = sourceCode.getStartIndex(node.expr) - 1
        if (node.op === "-") {
            const token = sourceCode.createTokenCursor(startIndex).next()
            return token.range[0]
        }
        let op = node.op
        if (node.op === "!") {
            op = (value) => value === "!" || value === "not"
        }
        return this._skipBefores(sourceCode, startIndex, [op], [true])
    },
    ident(sourceCode, node) {
        if (getName(node.val) === "function") {
            return this.getStartIndex(sourceCode, node.val)
        }
        return sourceCode.getIndexFromStylusNode(node)
    },
    ternary(sourceCode, node) {
        return Math.min(
            this.getStartIndex(sourceCode, node.falseExpr),
            this.getStartIndex(sourceCode, node.trueExpr),
            this.getStartIndex(sourceCode, node.cond),
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
            [true, false, false, true],
        )
    },
    if(sourceCode, node) {
        return this._skipBefores(
            sourceCode,
            node.cond,
            [node.negate ? "unless" : "if"],
            [true],
        )
    },
    call(sourceCode, node) {
        const index = sourceCode.getTokenIndex(sourceCode.getIndex(node.args))
        return sourceCode.tokens[index].range[0]
    },
    return(sourceCode, node) {
        return this._skipBefores(sourceCode, node.expr, ["return"], [true])
    },
    object(sourceCode, node) {
        const index = sourceCode.getIndexFromStylusNode(node)
        if (sourceCode.text[index] === "{") {
            return index
        }
        const cursor = sourceCode.createTokenCursor(index)
        let token = cursor.next()
        while (token.value !== "{" || isSkipToken(token)) {
            token = cursor.next()
        }
        if (token && token.value === "{") {
            return token.range[0]
        }
        return index
    },

    _skipBefores(sourceCode, base, words, lowers) {
        const idx =
            typeof base === "number"
                ? base
                : this.getStartIndex(sourceCode, base)
        const cursor = sourceCode.createBackwardTokenCursor(idx)
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
                    ? (value) => word(value.toLowerCase())
                    : (value) => value.toLowerCase() === word
            }
            return typeof word === "function" ? word : (value) => value === word
        }

        let check = next()

        let token = null
        while ((token = cursor.next())) {
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
