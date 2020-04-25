"use strict"

const postcss = require("postcss")
const StylusSourceCode = require("./stylus-source-code")
const parseSelector = require("./parse-selector")
const parseAtRuleNameAndCondition = require("./parse-atrule-name-and-condition")
const parseProp = require("./parse-prop")
const parseValue = require("./parse-value")
const parseOwnSemi = require("./parse-own-semi")
const parseRawBefore = require("./parse-raw-before")
const parseRawAfter = require("./parse-raw-after")
const parseExpression = require("./parse-expression")
const parseMediaParams = require("./parse-media-params")
const getSelectorEndIndex = require("./get-selector-end-index")
const getCssLiteralIndices = require("./get-css-literal-indices")
const { getName } = require("./stylus-nodes")

const debug = require("debug")("postcss-styl:parser")

/**
 * build raw
 * @param {string} value
 * @param {string} stylus
 * @param {string} rawCss
 */
function raw(value, rawStylus, rawCss) {
    const ret = { value }
    if (rawStylus !== value) {
        ret.raw = rawCss
        if (ret.raw !== rawStylus) {
            ret.stylus = rawStylus
        }
    }

    return ret
}

/**
 * Find last match element
 * @param {Array} arr array
 * @param {function} callback callback
 * @returns {*} element
 */
function findLast(arr, callback) {
    for (let index = arr.length - 1; index >= 0; index--) {
        const element = arr[index]
        if (callback(element)) {
            return element
        }
    }
    return undefined
}

class ProcessInfo {
    constructor(nodes, index, parentInfo) {
        this._nodes = nodes
        this._index = index
        this._parent = parentInfo
    }

    get nodes() {
        return this._nodes
    }

    /**
     * @returns {StylusNode|number} next sibling node or index
     */
    get nextSibling() {
        return this._nodes[this._index + 1]
    }

    /**
     * @returns {StylusNode|number} next node or index
     */
    get next() {
        return (
            this._next ||
            (this._next =
                this.nextSibling || (this._parent && this._parent.next))
        )
    }

    get parent() {
        return this._parent
    }

    get index() {
        return this._index
    }
}

/**
 * Checks if the given node is a node that can be assigned a semicolon.
 * @param {PostCSSNode}
 */
function isSemiOptNode(node) {
    return node.type === "decl" || (node.type === "atrule" && !node.nodes)
}

/**
 * Checks if the given node is mixin function node.
 * @param {StylusNode}
 */
function isMixinFunction(node) {
    if (getName(node) !== "function" || !node.block) {
        return false
    }
    return isAllMixinNodes(node.block.nodes)
}

/**
 * Checks if the given nodes is all property or selector or simpl atrule.
 * @param {StylusNode[]}
 */
function isAllMixinNodes(nodes) {
    for (const n of nodes) {
        if (getName(n) === "if") {
            if (!isAllMixinNodesForIf(n)) {
                return false
            }
        } else if (getName(n) === "each") {
            if (!isAllMixinNodesForEach(n)) {
                return false
            }
        } else if (getName(n) === "group") {
            if (!isAllMixinNodesForGroup(n)) {
                return false
            }
        } else if (getName(n) === "expression") {
            return maybeSelectorExpression(n, nodes)
        } else if (getName(n) !== "property") {
            // unknown
            return false
        }
    }
    return true
}

/**
 * Checks if the given node nodes is all property or atrule.
 * @param {StylusNode[]}
 */
function isAllMixinNodesForIf(node) {
    if (!node.block || !node.block.nodes) {
        return false
    }
    if (!isAllMixinNodes(node.block.nodes)) {
        return false
    }
    for (const e of node.elses) {
        if (getName(e) === "block") {
            if (!isAllMixinNodes(e.nodes)) {
                return false
            }
        } else if (getName(e) === "if") {
            if (!isAllMixinNodes([e])) {
                return false
            }
        } else {
            // unknown
            return false
        }
    }
    return true
}

/**
 * Checks if the given node nodes is all property or atrule.
 * @param {StylusNode[]}
 */
function isAllMixinNodesForEach(node) {
    if (!node.block) {
        return false
    }
    if (!isAllMixinNodes(node.block.nodes)) {
        return false
    }
    return true
}

/**
 * Checks if the given node nodes is all property or atrule.
 * @param {StylusNode[]}
 */
function isAllMixinNodesForGroup(node) {
    for (const sel of node.nodes) {
        if (getName(sel) !== "selector") {
            return false
        }
    }
    if (!isAllMixinNodes(node.block.nodes)) {
        return false
    }
    return true
}

/**
 * Checks if maybe selector
 * @param {*} expression
 * @param {*} nodes
 */
function maybeSelectorExpression(expression, nodes) {
    if (expression.nodes.length === 1) {
        if (getName(expression.nodes[0]) === "member") {
            const idx = nodes.indexOf(expression)
            for (const n of nodes.slice(idx)) {
                if (getName(n) === "group") {
                    return n.nodes.some(sel => getName(sel) === "selector")
                }
            }
        }
    }
    return false
}

/**
 * Checks if maybe interpolation
 * @param {*} expression
 * @param {*} sourceCode
 */
function maybeInterpolationExpression(expression, sourceCode) {
    return sourceCode.text[sourceCode.getIndex(expression)] === "{"
}

/**
 * Gets assignment exression value node if given node is known assignment
 * @param {*} node
 */
function getAssignmentExpressionValue(node) {
    const name = getName(node)
    if (name === "binop") {
        if (node.op === "[]=" && node.val) {
            return node.val
        }
    } else if (name === "member") {
        if (node.val) {
            return node.val
        }
    }
    return null
}

/**
 * Checks if given node is known assignment
 * @param {*} node
 */
function isAssignmentExpression(node) {
    return Boolean(getAssignmentExpressionValue(node))
}

/**
 * Checks if given node name is known exression name
 * @param {*} name
 */
function isExpressionName(name) {
    if (name === "binop") {
        // foo == bar
        return true
    }
    if (name === "member") {
        // foo.bar
        return true
    }
    if (name === "unaryop") {
        // !0 , !!0
        return true
    }
    if (name === "unit") {
        // 5px
        return true
    }
    if (name === "null") {
        // null
        return true
    }
    if (name === "boolean") {
        // true, false
        return true
    }
    if (name === "string") {
        // 'str'
        return true
    }
    if (name === "expression") {
        // (expr)
        return true
    }
    return false
}

/**
 * Checks if given node is conditional assignment
 * @param {*} node ternary node
 * @param {*} sourceCode
 */
function isConditionalAssignment(node, _sourceCode) {
    const { cond, trueExpr, falseExpr } = node
    // o is defined ? o : o = {}
    // ^^^^^^^^^^^^
    if (
        getName(cond) !== "binop" ||
        cond.op !== "is defined" ||
        getName(cond.left) !== "ident"
    ) {
        return false
    }
    const { name } = cond.left

    // o is defined ? o : o = {}
    //                ^
    if (getName(trueExpr) !== "expression" || trueExpr.nodes.length !== 1) {
        return false
    }
    const trueIdent = trueExpr.nodes[0]
    if (
        getName(trueIdent) !== "ident" ||
        trueIdent.name !== name ||
        getName(trueIdent.val) !== "null"
    ) {
        return false
    }

    // o is defined ? o : o = {}
    //                    ^^^^^^
    if (
        getName(falseExpr) === "ident" &&
        falseExpr.name === name &&
        getName(falseExpr.val) === "expression"
    ) {
        return true
    }
    return false
}

/**
 * Gets object expression node if given node is object expression
 * @param {*} node node
 */
function getObjectExpressionNode(node) {
    const nodes = node.nodes.filter(n => getName(n) !== "comment")
    if (nodes.length === 1 && getName(nodes[0]) === "object") {
        return {
            object: nodes[0],
            comments: node.nodes.slice(node.nodes.indexOf(nodes[0]) + 1),
        }
    }
    return null
}

/**
 * Checks if given node is object expression
 * @param {*} node node
 */
function isObjectExpression(node) {
    return Boolean(getObjectExpressionNode(node))
}

/**
 * adjust atrule raws.semicolon
 */
function atrulePostProc(atRule, { postfix, parsedNameAndCondition } = {}) {
    if (atRule.nodes && !postfix) {
        // raws.semicolon
        const lastAstNode = findLast(atRule.nodes, n => n.type !== "comment")
        if (lastAstNode) {
            if (isSemiOptNode(lastAstNode)) {
                if (!lastAstNode.omittedSemi) {
                    atRule.raws.semicolon = true
                } else {
                    delete lastAstNode.omittedSemi
                }
            }
        } else {
            delete atRule.raws.semicolon
        }
    } else if (
        parsedNameAndCondition &&
        !parsedNameAndCondition.raw.semicolon
    ) {
        atRule.omittedSemi = true
    }
}

class StylusParser {
    constructor(input) {
        this.input = input
    }

    parse() {
        this.text = this.input.css
        try {
            this.sourceCode = new StylusSourceCode(this.text)
            this.node = this.sourceCode.parse()
        } catch (error) {
            throw this.input.error(error.message, error.lineno, error.column)
        }

        this.root = this.stylesheet(this.node)
    }

    stylesheet(node) {
        this.sourceEnd = {
            line: this.sourceCode.lines.length,
            column: this.sourceCode.lines[this.sourceCode.lines.length - 1]
                .length,
        }
        // Create and set parameters for Root node
        const rootNode = postcss.root()
        rootNode.source = {
            input: this.input,
            start: { line: 1, column: 1 },
            lang: "stylus",
            syntax: require("../index"),
        }

        // Raws for root node
        rootNode.raws = {
            semicolon: false,
            after: "",
        }

        node.nodes.forEach((n, i) =>
            this.process(n, rootNode, new ProcessInfo(node.nodes, i))
        )

        // raws.semicolon
        const lastAstNode = findLast(rootNode.nodes, n => n.type !== "comment")
        if (lastAstNode) {
            if (isSemiOptNode(lastAstNode)) {
                if (!lastAstNode.omittedSemi) {
                    rootNode.raws.semicolon = true
                } else {
                    delete lastAstNode.omittedSemi
                }
            }
        } else {
            delete rootNode.raws.semicolon
        }

        const rawAfter = parseRawAfter(
            this.sourceCode,
            this.sourceCode.text.length - 1,
            {
                blockCommentIsRaw: false,
            }
        )
        rootNode.raws.after = rawAfter.after
        if (rawAfter.after !== rawAfter.stylusAfter) {
            rootNode.raws.stylusAfter = rawAfter.stylusAfter
        }
        this.pushInlineComments(rootNode, rawAfter.inlineComments)
        return rootNode
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    process(node, parent, info) {
        const name = getName(node)
        if (this[name]) {
            return this[name](node, parent, info) || null
        }
        // TODO: Unknown type
        debug(
            `The parsing of \`${name}\` is not implemented yet. at \n${this.input.file}`
        )
        return null
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    group(node, parent, info) {
        node.nodes.forEach((n, i) =>
            this.process(n, parent, new ProcessInfo(node.nodes, i, info))
        )
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    media(node, parent, info) {
        const atRule = this.atruleImpl(
            node,
            {
                blockNode: node.block,
            },
            parent,
            info
        )

        const startIndex =
            this.sourceCode.getIndex(atRule.source.start) +
            6 /* @media */ +
            atRule.raws.afterName.length
        const paramsText =
            (atRule.raws.params &&
                (atRule.raws.params.stylus || atRule.raws.params.raw)) ||
            atRule.params

        const mediaParams = parseMediaParams(
            this.sourceCode,
            startIndex,
            startIndex + paramsText.length - 1
        )
        if (
            mediaParams.raw.stylus !== mediaParams.raw.raw &&
            mediaParams.params !== atRule.params
        ) {
            atRule.raws.params = mediaParams.raw
            atRule.params = mediaParams.params
        }
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    charset(node, parent, info) {
        this.atruleImpl(node, {}, parent, info)
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    supports(node, parent, info) {
        this.atruleImpl(node, { blockNode: node.block }, parent, info)
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    import(node, parent, info) {
        this.atruleImpl(node, {}, parent, info)
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    keyframes(node, parent, info) {
        this.atruleImpl(node, { blockNode: node.block }, parent, info)
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    extend(node, parent, info) {
        this.atruleImpl(node, {}, parent, info)
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    literal(node, parent, info) {
        if (node.css) {
            // `@css`
            this.atruleCssLiteralImpl(node, parent, info)
        }
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    atrule(node, parent, info) {
        this.atruleImpl(node, { blockNode: node.block }, parent, info)
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    ternary(node, parent, info) {
        if (isConditionalAssignment(node, this.sourceCode)) {
            // conditional assignment
            const valueNode =
                node.falseExpr.val.nodes[node.falseExpr.val.nodes.length - 1]
            const valueNodeName = getName(valueNode)
            let postcssNode = null
            if (valueNodeName === "atblock") {
                postcssNode = this.atruleAtblockImpl(
                    node,
                    { blockNode: valueNode.block },
                    parent,
                    info
                )
            } else if (valueNodeName === "object") {
                postcssNode = this.atruleObjectExpressionImpl(
                    node,
                    {
                        object: valueNode,
                    },
                    parent,
                    info
                )
            } else {
                postcssNode = this.declImpl(
                    node,
                    { propStartNode: node, valueLast: valueNode },
                    parent,
                    info
                )
            }
            postcssNode.assignment = true
            postcssNode.conditional = true
            return
        }

        this.atruleImpl(
            node,
            { expression: true },
            parent,
            info
        ).expression = true
    }

    pushSelectorStack(node) {
        const stack = this._selectorsStack || (this._selectorsStack = [])
        stack.push(node)
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    selector(node, parent, info) {
        if (info.nextSibling && getName(info.nextSibling) === "selector") {
            this.pushSelectorStack(node)
            return
        }

        let selectors = [node]
        if (this._selectorsStack) {
            selectors = [...this._selectorsStack, node]
            delete this._selectorsStack
        }

        const selectorLocations = selectors.map((selector, index) => {
            // start location
            const selectorStartIndex = this.sourceCode.getIndex(selector)

            // calc end location
            let selectorEndIndex = undefined
            const nextSelector = selectors[index + 1]
            if (selectors[index + 1]) {
                selectorEndIndex = this.sourceCode.getIndex(nextSelector) - 1
            } else {
                selectorEndIndex = null
            }
            return [selectorStartIndex, selectorEndIndex]
        })
        this.ruleImpl(
            node,
            {
                selectorLocations,
                beforeBlockNodeEndIndex: getSelectorEndIndex(
                    this.sourceCode,
                    node
                ),
                blockNode: node.block,
            },
            parent,
            info
        )
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    property(node, parent, info) {
        if (node.segments.length === 1) {
            const prop = node.segments[0]
            if (getName(prop) === "ident" && prop.name === "@apply") {
                // @apply
                this.atruleImpl(node, {}, parent, info)
                return
            }
        }

        this.declImpl(node, { propStartNode: node.segments[0] }, parent, info)
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    // eslint-disable-next-line complexity
    expression(node, parent, info) {
        if (node.isEmpty) {
            this.ruleEmptyExpressionImpl(node, parent, info)
            return
        }
        if (maybeSelectorExpression(node, info.nodes)) {
            this.pushSelectorStack(node)
            return
        }
        if (maybeInterpolationExpression(node, this.sourceCode)) {
            // @extend like
            this.atruleExpressionImpl(node, parent, info).expression = true
            return
        }
        const first = node.nodes[0]
        if (first) {
            if (isAssignmentExpression(first)) {
                const valueNode = getAssignmentExpressionValue(first)
                if (
                    getName(valueNode) === "expression" &&
                    valueNode.nodes[0] &&
                    getName(valueNode.nodes[0]) === "atblock"
                ) {
                    const needAdjustInfo = node.nodes.length === 2
                    let atblockInfo = info
                    if (needAdjustInfo) {
                        // parser bug?
                        // see tests/fixtures/hash04-block/input.styl
                        const adjustNodes = [
                            ...info.nodes.slice(0, info.index + 1),
                            node.nodes[1],
                            ...info.nodes.slice(info.index + 1),
                        ]
                        atblockInfo = new ProcessInfo(
                            adjustNodes,
                            info.index,
                            info.parent
                        )
                    }
                    // foo.bar = @block
                    this.atruleAtblockImpl(
                        node,
                        { blockNode: valueNode.nodes[0].block },
                        parent,
                        atblockInfo
                    ).assignment = true

                    if (needAdjustInfo) {
                        // parser bug?
                        this.process(
                            node.nodes[1],
                            parent,
                            new ProcessInfo(
                                atblockInfo.nodes,
                                info.index + 1,
                                info.parent
                            )
                        )
                    }
                } else {
                    // foo.bar = baz
                    this.declImpl(
                        node,
                        { propStartNode: node },
                        parent,
                        info
                    ).assignment = true
                }
                return
            }
            const firstName = getName(first)
            if (node.nodes.length === 1) {
                if (firstName === "call") {
                    // fn()
                    this.atruleImpl(node, {}, parent, info).call = true
                    return
                }
                if (isExpressionName(firstName)) {
                    this.atruleImpl(
                        node,
                        { expression: true },
                        parent,
                        info
                    ).expression = true
                    return
                }
                if (firstName === "atblock") {
                    this.atruleAtblockImpl(
                        node,
                        { blockNode: first.block },
                        parent,
                        info
                    ).expression = true
                    return
                }
            } else if (node.nodes.length > 1) {
                if (firstName === "unit") {
                    this.atruleImpl(
                        node,
                        { expression: true },
                        parent,
                        info
                    ).expression = true
                    return
                }
            }
        }
        // TODO: Unknown expression type
        debug(
            `Unknown expression type: ${node.nodes[0] &&
                getName(node.nodes[0])}, nodes.length: ${
                node.nodes.length
            }. at \n${this.input.file}`
        )
        this.atruleImpl(
            node,
            { expression: true },
            parent,
            info
        ).expression = true
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    ident(node, parent, info) {
        const valNodeName = getName(node.val)
        if (
            valNodeName === "expression" &&
            node.val.nodes[0] &&
            getName(node.val.nodes[0]) === "atblock"
        ) {
            const atblock = node.val.nodes[0]
            this.atruleAtblockImpl(
                node,
                { blockNode: atblock.block },
                parent,
                info
            ).assignment = true
        } else if (valNodeName === "function") {
            this.function(node.val, parent, info)
        } else if (valNodeName === "null") {
            const cursor = this.sourceCode.createTokenCursor(
                this.sourceCode.getIndex(node)
            )
            cursor.next()
            const token = cursor.next()
            if (token && token.value === ":") {
                // empty decl
                this.declImpl(node, { propStartNode: node }, parent, info)
            } else {
                this.atruleImpl(
                    node,
                    { expression: true },
                    parent,
                    info
                ).expression = true
            }
        } else if (valNodeName === "expression") {
            if (isObjectExpression(node.val)) {
                const { object, comments } = getObjectExpressionNode(node.val)
                this.atruleObjectExpressionImpl(
                    node,
                    { object },
                    parent,
                    info
                ).assignment = true
                for (const comment of comments) {
                    this.comment(comment, parent)
                }
            } else {
                this.declImpl(
                    node,
                    { propStartNode: node },
                    parent,
                    info
                ).assignment = true
            }
        } else if (valNodeName === "binop") {
            this.atruleImpl(
                node,
                { expression: true },
                parent,
                info
            ).expression = true
        } else {
            // TODO: Unknown ident val type
            debug(
                `Unknown ident val type \`${valNodeName}\`. at \n${this.input.file}`
            )
        }
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    function(node, parent, info) {
        if (isMixinFunction(node)) {
            const atRule = this.atruleImpl(
                node,
                { blockNode: node.block },
                parent,
                info
            )
            atRule.mixin = true
            atRule.function = true
        } else {
            this.atruleImpl(
                node,
                { blockNode: node.block },
                parent,
                info
            ).function = true
        }
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    call(node, parent, info) {
        const atRule = this.atruleImpl(
            node,
            { blockNode: node.block },
            parent,
            info
        )
        atRule.call = true
        if (node.block) {
            atRule.callBlockMixin = true
        }
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    binop(node, parent, info) {
        this.atruleImpl(
            node,
            { blockNode: node.block, expression: true },
            parent,
            info
        ).expression = true
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    each(node, parent, info) {
        let postfix = false
        if (node.block) {
            if (node.block.nodes && node.block.nodes[0]) {
                postfix =
                    this.sourceCode.getIndex(node.block.nodes[0]) <
                    this.sourceCode.getIndex(node)
            } else {
                postfix =
                    this.sourceCode.getIndex(node.block) <
                    this.sourceCode.getIndex(node)
            }
        }
        this.atruleImpl(node, { blockNode: node.block, postfix }, parent, info)
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    if(node, parent, info) {
        const elses = node.elses.map(el => {
            if (getName(el) === "if") {
                const idx = this.sourceCode.getIndex(el)
                const cursor = this.sourceCode.createBackwardTokenCursor(idx)
                let token = cursor.next()
                while (token && token.value !== "else") {
                    token = cursor.next()
                }
                return {
                    index: token.range[0],
                    block: el.block,
                }
            }
            return {
                block: el,
            }
        })
        const nodes = [node, ...elses.map(e => e.index || e.block)]

        this.atruleImpl(
            node,
            { blockNode: node.block, postfix: node.postfix },
            parent,
            new ProcessInfo(nodes, 0, info)
        )

        elses.forEach((el, i) => {
            this.atruleImpl(
                el.index || el.block,
                { blockNode: el.block },
                parent,
                new ProcessInfo(nodes, i + 1, info)
            )
        })
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    return(node, parent, info) {
        this.atruleImpl(node, {}, parent, info)
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    comment(node, parent, _info) {
        const startIndex = this.sourceCode.getIndex(node)
        const commentToken = this.sourceCode.tokens[
            this.sourceCode.getTokenIndex(startIndex)
        ]
        const endIndex = commentToken.range[1] - 1
        const contents = commentToken.value.replace(/^\/\*|\*\/$/gu, "")
        const text = contents.trim()

        const commentSource = {
            start: this.sourceCode.getLoc(startIndex),
            input: this.input,
            end: this.sourceCode.getLoc(endIndex),
        }

        const {
            before: rawBefore,
            stylusBefore: rawStylusBefore,
        } = this.processRawBefore(
            parent,
            this.sourceCode.getIndex(commentSource.start) - 1,
            parent
        )
        const commentRaws = {
            before: rawBefore,
            left: text ? /^\s*/u.exec(contents)[0] : contents,
            right: text ? /\s*$/u.exec(contents)[0] : "",
        }
        if (rawBefore !== rawStylusBefore) {
            commentRaws.stylusBefore = rawStylusBefore
        }

        // Create Rule node
        const comment = postcss.comment()
        comment.parent = parent
        comment.source = commentSource
        comment.raws = commentRaws
        comment.text = text

        parent.nodes.push(comment)
    }

    /* eslint-disable complexity */
    /**
     * @param {StylusNode|number} nodeOrIndex
     * @param {*} infomation
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    atruleImpl(
        nodeOrIndex,
        { blockFirstNode, blockNode, postfix, expression },
        parent,
        info
    ) {
        /* eslint-enable complexity */
        const startIndex = this.sourceCode.getIndex(nodeOrIndex)
        let parseMaxEndIndex = undefined
        if (parent.postfix) {
            parseMaxEndIndex =
                this.sourceCode.getIndex(parent.source.start) -
                (parent.raws.postfixBefore
                    ? parent.raws.postfixBefore.length
                    : 0) -
                1
        } else if (
            blockNode &&
            !postfix &&
            blockNode.nodes &&
            blockNode.nodes[0]
        ) {
            parseMaxEndIndex = this.sourceCode.getIndex(blockNode.nodes[0])
            if (
                this.sourceCode.text[parseMaxEndIndex - 1] === "{" &&
                /^\S*$/u.test(this.sourceCode.text[parseMaxEndIndex])
            ) {
                parseMaxEndIndex = parseMaxEndIndex - 1
            }
        }
        const parsedNameAndCondition = parseAtRuleNameAndCondition(
            this.sourceCode,
            startIndex,
            parseMaxEndIndex,
            { expression }
        )
        let atRuleSource = null
        let atRuleRaws = null
        let pythonic = false
        const blockAfterInlineComments = []
        if (blockNode && !postfix) {
            // block
            const {
                hasBrace,
                bodyStartIndex,
                bodyEndIndex,
                rawAfter,
                rawStylusAfter,
                afterInlineComments,
                endIndex,
            } = this.blockInfo(
                parsedNameAndCondition.endIndex,
                blockFirstNode || blockNode.nodes[0],
                parent,
                info
            )
            blockAfterInlineComments.push(...afterInlineComments)

            atRuleSource = {
                start: this.sourceCode.getLoc(startIndex),
                startChildren: this.sourceCode.getLoc(bodyStartIndex),
                input: this.input,
                end: this.sourceCode.getLoc(endIndex),
            }
            atRuleRaws = {
                before: undefined,
                between: parsedNameAndCondition.raw.between,
                afterName: parsedNameAndCondition.raw.afterName,
                semicolon: false,
                after: "",
            }
            if (hasBrace && bodyEndIndex < endIndex) {
                atRuleSource.endChildren = this.sourceCode.getLoc(bodyEndIndex)
                atRuleRaws.after = rawAfter
                if (rawAfter !== rawStylusAfter) {
                    atRuleRaws.stylusAfter = rawStylusAfter
                }
            }
            const { ownSemicolon } = parseOwnSemi(this.sourceCode, endIndex)
            if (ownSemicolon) {
                atRuleRaws.ownSemicolon = ownSemicolon
            }
            pythonic = !hasBrace
        } else {
            const betweenLength = (
                parsedNameAndCondition.raw.stylusBetween ||
                parsedNameAndCondition.raw.between
            ).length
            atRuleSource = {
                start: this.sourceCode.getLoc(startIndex),
                input: this.input,
                end: this.sourceCode.getLoc(
                    parsedNameAndCondition.endIndex - betweenLength
                ),
                rawEnd: this.sourceCode.getLoc(parsedNameAndCondition.endIndex),
            }
            atRuleRaws = {
                before: undefined,
                between: parsedNameAndCondition.raw.between,
                afterName: parsedNameAndCondition.raw.afterName,
            }
            if (postfix) {
                atRuleRaws.after = ""
            }
        }
        let rawBefore = null
        let rawStylusBefore = null
        if (postfix) {
            const {
                after: postfixBefore,
                stylusAfter: postfixStylusBefore,
            } = parseRawAfter(this.sourceCode, startIndex - 1)
            rawBefore = ""
            rawStylusBefore = ""
            atRuleRaws.postfixBefore = postfixBefore
            if (postfixBefore !== postfixStylusBefore) {
                atRuleRaws.postfixStylusBefore = postfixStylusBefore
            }
        } else if (parent.postfix) {
            let blockParent = parent.parent
            while (blockParent.postfix) {
                blockParent = blockParent.parent
            }
            const parentIndex = blockParent.nodes.indexOf(parent)
            ;({
                before: rawBefore,
                stylusBefore: rawStylusBefore,
            } = this.processRawBefore({
                last: blockParent.nodes[parentIndex - 1],
                source: blockParent.source,
                parent,
            }))
        } else {
            ;({
                before: rawBefore,
                stylusBefore: rawStylusBefore,
            } = this.processRawBefore(parent, undefined, parent))
        }
        atRuleRaws.before = rawBefore
        if (rawBefore !== rawStylusBefore) {
            atRuleRaws.stylusBefore = rawStylusBefore
        }

        if (
            parsedNameAndCondition.raw.between !==
            parsedNameAndCondition.raw.stylusBetween
        ) {
            atRuleRaws.stylusBetween = parsedNameAndCondition.raw.stylusBetween
        }
        const rawParams = raw(
            parsedNameAndCondition.params,
            parsedNameAndCondition.raw.stylus,
            parsedNameAndCondition.raw.css
        )
        if (rawParams.raw) {
            atRuleRaws.params = rawParams
        }
        if (parsedNameAndCondition.raw.identifier !== "@") {
            atRuleRaws.identifier = parsedNameAndCondition.raw.identifier
        }

        // Create Rule node
        const atRule = postcss.atRule()
        atRule.parent = parent
        atRule.name = parsedNameAndCondition.name
        atRule.source = atRuleSource
        atRule.params = parsedNameAndCondition.params
        atRule.raws = atRuleRaws

        // Stylus property
        if (pythonic) {
            atRule.pythonic = true
        }
        if (postfix) {
            atRule.postfix = true
        }
        parent.nodes.push(atRule)

        const childNodes =
            blockNode && (blockNode.nodes || (postfix && [blockNode]))
        if (childNodes) {
            atRule.nodes = []
            childNodes.forEach((n, i) =>
                this.process(n, atRule, new ProcessInfo(childNodes, i, info))
            )
            this.pushInlineComments(atRule, blockAfterInlineComments)
        }
        atrulePostProc(atRule, { postfix, parsedNameAndCondition })
        return atRule
    }

    atruleAtblockImpl(node, { blockNode }, parent, info) {
        const atrule = this.atruleImpl(
            node,
            { expression: true, blockNode },
            parent,
            info
        )
        atrule.atblock = true
        return atrule
    }

    atruleExpressionImpl(node, parent, _info) {
        // `{...}`
        const startIndex = this.sourceCode.getIndex(node)
        const parsedExpression = parseExpression(this.sourceCode, startIndex)

        // empty name atrule
        const atRuleSource = {
            start: this.sourceCode.getLoc(startIndex),
            input: this.input,
            end: this.sourceCode.getLoc(parsedExpression.endIndex),
        }

        const {
            before: rawBefore,
            stylusBefore: rawStylusBefore,
        } = this.processRawBefore(parent, undefined, parent)
        const atRuleRaws = {
            before: rawBefore,
            between: "",
            afterName: "",
        }
        if (rawBefore !== rawStylusBefore) {
            atRuleRaws.stylusBefore = rawStylusBefore
        }
        const rawParams = raw(
            parsedExpression.params,
            parsedExpression.raw.stylus,
            parsedExpression.raw.css
        )
        if (rawParams.raw) {
            atRuleRaws.params = rawParams
        }
        atRuleRaws.identifier = ""

        // Create Rule node
        const atRule = postcss.atRule()
        atRule.parent = parent
        atRule.name = ""
        atRule.source = atRuleSource
        atRule.params = parsedExpression.params
        atRule.raws = atRuleRaws
        // Stylus property
        parent.nodes.push(atRule)
        if (!parsedExpression.raw.semicolon) {
            atRule.omittedSemi = true
        }
        return atRule
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    atruleObjectExpressionImpl(node, { object, withinObject }, parent, info) {
        const objectOpenIndex = this.sourceCode.getIndex(object)
        const startIndex = this.sourceCode.getIndex(node)
        const objectContentStartIndex = objectOpenIndex + 1

        const parsedNameAndCondition = parseAtRuleNameAndCondition(
            this.sourceCode,
            startIndex,
            objectContentStartIndex,
            { expression: true }
        )

        const objectCloseIndex =
            this.getCloseBraceIndex(objectOpenIndex, parent) ||
            this.getBlockEndIndex(objectOpenIndex + 1, parent, {
                hasBrace: true,
                info,
                openBraceIndex: objectOpenIndex,
            })

        const {
            after: rawAfter,
            stylusAfter: rawStylusAfter,
            inlineComments: blockAfterInlineComments,
        } = parseRawAfter(this.sourceCode, objectCloseIndex - 1, {
            blockCommentIsRaw: false,
        })

        const atRuleSource = {
            start: this.sourceCode.getLoc(startIndex),
            startChildren: this.sourceCode.getLoc(objectContentStartIndex),
            input: this.input,
            end: this.sourceCode.getLoc(objectCloseIndex),
        }
        const atRuleRaws = {
            before: undefined,
            between: parsedNameAndCondition.raw.between,
            afterName: parsedNameAndCondition.raw.afterName,
            semicolon: false,
            after: rawAfter,
        }
        if (rawAfter !== rawStylusAfter) {
            atRuleRaws.stylusAfter = rawStylusAfter
        }

        const {
            before: rawBefore,
            stylusBefore: rawStylusBefore,
        } = this.processRawBefore(parent, undefined, parent)
        atRuleRaws.before = rawBefore
        if (rawBefore !== rawStylusBefore) {
            atRuleRaws.stylusBefore = rawStylusBefore
        }

        if (
            parsedNameAndCondition.raw.between !==
            parsedNameAndCondition.raw.stylusBetween
        ) {
            atRuleRaws.stylusBetween = parsedNameAndCondition.raw.stylusBetween
        }
        const rawParams = raw(
            parsedNameAndCondition.params,
            parsedNameAndCondition.raw.stylus,
            parsedNameAndCondition.raw.css
        )
        if (rawParams.raw) {
            atRuleRaws.params = rawParams
        }
        if (parsedNameAndCondition.raw.identifier !== "@") {
            atRuleRaws.identifier = parsedNameAndCondition.raw.identifier
        }
        const { ownSemicolon } = parseOwnSemi(
            this.sourceCode,
            objectCloseIndex + 1,
            {
                withinObject,
            }
        )
        if (ownSemicolon) {
            atRuleRaws.ownSemicolon = ownSemicolon
            atRuleSource.rawEnd = this.sourceCode.getLoc(
                objectCloseIndex + ownSemicolon.length
            )
        }

        // Create Rule node
        const atRule = postcss.atRule()
        atRule.parent = parent
        atRule.name = parsedNameAndCondition.name
        atRule.source = atRuleSource
        atRule.params = parsedNameAndCondition.params
        atRule.raws = atRuleRaws
        atRule.cssLiteral = true

        parent.nodes.push(atRule)

        atRule.nodes = []

        const properties = Object.keys(object.keys)
            .map(keyName => {
                const keyNode = object.keys[keyName]
                const valNode = object.vals[keyName]
                const index = this.sourceCode.getIndex(keyNode)
                return {
                    keyName,
                    keyNode,
                    valNode,
                    index,
                }
            })
            .sort((a, b) =>
                a.index > b.index ? 1 : a.index < b.index ? -1 : 0
            )

        const keyNodes = properties.map(prop => prop.keyNode)
        properties.forEach((prop, i) => {
            const key = prop.keyNode
            const val = prop.valNode

            const childInfo = new ProcessInfo(keyNodes, i, info)

            if (isObjectExpression(val)) {
                const subObjects = getObjectExpressionNode(val)
                this.atruleObjectExpressionImpl(
                    key,
                    {
                        object: subObjects.object,
                        withinObject: true,
                    },
                    atRule,
                    childInfo
                ).objectProperty = true

                for (const comment of subObjects.comments) {
                    this.comment(comment, atRule)
                }
            } else {
                this.declImpl(
                    key,
                    {
                        propStartNode: key,
                        valueLast: val.nodes[val.nodes.length - 1],
                        withinObject: true,
                    },
                    atRule,
                    childInfo
                ).objectProperty = true
            }
        })

        this.pushInlineComments(atRule, blockAfterInlineComments)
        atrulePostProc(atRule, {})

        atRule.object = true
        return atRule
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    atruleCssLiteralImpl(node, parent, _info) {
        const startIndex = this.sourceCode.getIndex(node)
        const { start: cssOpenIndex, end: endIndex } = getCssLiteralIndices(
            this.sourceCode,
            node
        )
        const cssStartIndex = cssOpenIndex + 1
        const cssStartLoc = this.sourceCode.getLoc(cssStartIndex)

        const cssEndIndex = endIndex - 1
        const parsedNameAndCondition = parseAtRuleNameAndCondition(
            this.sourceCode,
            startIndex,
            cssStartIndex
        )

        const css = this.sourceCode.getText(cssStartIndex, cssEndIndex)

        let postCssRoot = null
        try {
            postCssRoot = postcss.parse(css, { from: this.input.file })
        } catch (error) {
            const errorLoc = offsetLocation(error)
            throw this.input.error(error.reason, errorLoc.line, errorLoc.column)
        }
        postCssRoot.walk(n => {
            // apply offset locations
            n.source.start = offsetLocation(n.source.start)
            if (n.source.end != null) {
                n.source.end = offsetLocation(n.source.end)
            }
        })

        const atRuleSource = {
            start: this.sourceCode.getLoc(startIndex),
            input: this.input,
            end: this.sourceCode.getLoc(endIndex),
        }
        const atRuleRaws = {
            before: undefined,
            between: parsedNameAndCondition.raw.between,
            afterName: parsedNameAndCondition.raw.afterName,
            semicolon: false,
            after: postCssRoot.raws.after,
        }

        const {
            before: rawBefore,
            stylusBefore: rawStylusBefore,
        } = this.processRawBefore(parent, undefined, parent)
        atRuleRaws.before = rawBefore
        if (rawBefore !== rawStylusBefore) {
            atRuleRaws.stylusBefore = rawStylusBefore
        }

        if (
            parsedNameAndCondition.raw.between !==
            parsedNameAndCondition.raw.stylusBetween
        ) {
            atRuleRaws.stylusBetween = parsedNameAndCondition.raw.stylusBetween
        }
        const rawParams = raw(
            parsedNameAndCondition.params,
            parsedNameAndCondition.raw.stylus,
            parsedNameAndCondition.raw.css
        )
        if (rawParams.raw) {
            atRuleRaws.params = rawParams
        }
        if (parsedNameAndCondition.raw.identifier !== "@") {
            atRuleRaws.identifier = parsedNameAndCondition.raw.identifier
        }

        // Create Rule node
        const atRule = postcss.atRule()
        atRule.parent = parent
        atRule.name = parsedNameAndCondition.name
        atRule.source = atRuleSource
        atRule.params = parsedNameAndCondition.params
        atRule.raws = atRuleRaws
        atRule.cssLiteral = true

        parent.nodes.push(atRule)

        atRule.nodes = postCssRoot.nodes
        for (const child of atRule.nodes) {
            child.parent = atRule
        }

        return atRule

        /**
         * Offset location
         * @param {*} loc
         */
        function offsetLocation(loc) {
            return loc.line === 1
                ? {
                      line: cssStartLoc.line,
                      column: cssStartLoc.column + loc.column - 1,
                  }
                : {
                      line: loc.line + cssStartLoc.line - 1,
                      column: loc.column,
                  }
        }
    }

    /**
     * @param {StylusNode} node
     * @param {*} infomation
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    ruleImpl(
        _node,
        {
            selectorLocations,
            beforeBlockNodeEndIndex,
            blockFirstNode,
            blockNode,
        },
        parent,
        info
    ) {
        // block
        const {
            hasBrace,
            bodyStartIndex,
            bodyEndIndex,
            rawAfter,
            rawStylusAfter,
            afterInlineComments,
            startIndex: blockStartIndex,
            endIndex,
        } = this.blockInfo(
            beforeBlockNodeEndIndex,
            blockFirstNode || blockNode.nodes[0],
            parent,
            info
        )

        selectorLocations[selectorLocations.length - 1][1] = blockStartIndex - 1

        // raws
        const parsedSelector = parseSelector(this.sourceCode, selectorLocations)

        // location
        const ruleSource = {
            start: this.sourceCode.getLoc(selectorLocations[0][0]),
            startChildren: this.sourceCode.getLoc(bodyStartIndex),
            input: this.input,
            end: this.sourceCode.getLoc(endIndex),
        }

        const {
            before: rawBefore,
            stylusBefore: rawStylusBefore,
        } = this.processRawBefore(parent, undefined, parent)

        const ruleRaws = {
            before: rawBefore,
            between: parsedSelector.raw.between,
            semicolon: false,
            selector: undefined,
            after: "",
        }
        if (rawBefore !== rawStylusBefore) {
            ruleRaws.stylusBefore = rawStylusBefore
        }
        if (parsedSelector.raw.between !== parsedSelector.raw.stylusBetween) {
            ruleRaws.stylusBetween = parsedSelector.raw.stylusBetween
        }

        const rawSelector = raw(
            parsedSelector.selector,
            parsedSelector.raw.stylus,
            parsedSelector.raw.css
        )
        if (rawSelector.raw) {
            ruleRaws.selector = rawSelector
        } else {
            delete ruleRaws.selector
        }

        if (hasBrace && bodyEndIndex < endIndex) {
            ruleSource.endChildren = this.sourceCode.getLoc(bodyEndIndex)
            ruleRaws.after = rawAfter
            if (rawAfter !== rawStylusAfter) {
                ruleRaws.stylusAfter = rawStylusAfter
            }
        }

        const { ownSemicolon } = parseOwnSemi(this.sourceCode, endIndex)
        if (ownSemicolon) {
            ruleRaws.ownSemicolon = ownSemicolon
        }

        // Create Rule node
        const rule = postcss.rule()
        rule.parent = parent
        rule.source = ruleSource
        rule.selector = parsedSelector.selector
        rule.raws = ruleRaws
        // Stylus property
        if (!hasBrace) {
            rule.pythonic = true
        }
        parent.nodes.push(rule)

        blockNode.nodes.forEach((n, i) =>
            this.process(n, rule, new ProcessInfo(blockNode.nodes, i, info))
        )
        this.pushInlineComments(rule, afterInlineComments)

        // raws.semicolon
        const lastAstNode = findLast(rule.nodes, n => n.type !== "comment")
        if (lastAstNode) {
            if (isSemiOptNode(lastAstNode)) {
                if (!lastAstNode.omittedSemi) {
                    rule.raws.semicolon = true
                } else {
                    delete lastAstNode.omittedSemi
                    rule.raws.semicolon = false
                }
            }
        } else {
            delete rule.raws.semicolon
        }

        return rule
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    ruleEmptyExpressionImpl(node, parent, _info) {
        // `{}`
        const startIndex = this.sourceCode.getIndex(node)
        const parsedExpression = parseExpression(this.sourceCode, startIndex)

        // empty selector rule
        const ruleSource = {
            start: this.sourceCode.getLoc(startIndex),
            input: this.input,
            end: this.sourceCode.getLoc(parsedExpression.endIndex),
        }
        const {
            before: rawBefore,
            stylusBefore: rawStylusBefore,
        } = this.processRawBefore(parent, undefined, parent)
        const ruleRaws = {
            before: rawBefore,
            between: "",
            after: parsedExpression.expression,
        }
        if (rawBefore !== rawStylusBefore) {
            ruleRaws.stylusBefore = rawStylusBefore
        }
        const rawExpression = raw(
            parsedExpression.expression,
            parsedExpression.raw.stylusExpression,
            parsedExpression.raw.expression
        )
        if (rawExpression.raw) {
            ruleRaws.after = rawExpression.raw
            if (rawExpression.raw !== rawExpression.stylus) {
                ruleRaws.stylusAfter = rawExpression.stylus
            }
        }

        // Create Rule node
        const rule = postcss.rule()
        rule.parent = parent
        rule.source = ruleSource
        rule.selector = ""
        rule.raws = ruleRaws
        parent.nodes.push(rule)
    }

    declImpl(node, { propStartNode, valueLast, withinObject }, parent, _info) {
        const propStartIndex = this.sourceCode.getIndex(propStartNode)
        const { prop, endIndex: propEndIndex } = parseProp(
            this.sourceCode,
            propStartIndex
        )
        const parsedValue = parseValue(
            this.sourceCode,
            propEndIndex + 1,
            parent.postfix
                ? this.sourceCode.getIndex(parent.source.start) -
                      (parent.raws.postfixBefore
                          ? parent.raws.postfixBefore.length
                          : 0) -
                      1
                : undefined,
            {
                minEnd: valueLast
                    ? this.sourceCode.getIndex(valueLast)
                    : undefined,
                withinObject,
            }
        )

        // location
        const startIndex = Math.min(
            this.sourceCode.getIndex(node),
            propStartIndex
        )

        const declSource = {
            start: this.sourceCode.getLoc(startIndex),
            input: this.input,
            end: this.sourceCode.getLoc(parsedValue.endIndex),
        }

        let rawBefore = null
        let rawStylusBefore = null
        if (!parent.postfix) {
            ;({
                before: rawBefore,
                stylusBefore: rawStylusBefore,
            } = this.processRawBefore(parent, undefined, parent))
        } else {
            let blockParent = parent.parent
            while (blockParent.postfix) {
                blockParent = blockParent.parent
            }
            const parentIndex = blockParent.nodes.indexOf(parent)
            ;({
                before: rawBefore,
                stylusBefore: rawStylusBefore,
            } = this.processRawBefore(
                {
                    last: blockParent.nodes[parentIndex - 1],
                    source: blockParent.source,
                },
                undefined,
                parent
            ))
        }

        const declRaws = {
            before: rawBefore,
            // after: "",
            between: parsedValue.raw.between,
        }

        if (rawBefore !== rawStylusBefore) {
            declRaws.stylusBefore = rawStylusBefore
        }
        if (parsedValue.raw.important) {
            declRaws.important = parsedValue.raw.important
        }
        const rawValue = raw(
            parsedValue.value,
            parsedValue.raw.stylus,
            parsedValue.raw.css
        )
        if (rawValue.raw) {
            declRaws.value = rawValue
        }

        // Create Declaration node
        const decl = postcss.decl()
        decl.parent = parent
        decl.raws = declRaws
        decl.source = declSource
        decl.prop = prop
        if (parsedValue.important) {
            decl.important = true
        }
        decl.value = parsedValue.value
        // Stylus property
        if (parsedValue.raw.between !== parsedValue.raw.stylusBetween) {
            decl.raws.stylusBetween = parsedValue.raw.stylusBetween
        }
        if (!parsedValue.raw.semicolon) {
            decl.omittedSemi = true
        }
        parent.nodes.push(decl)

        return decl
    }

    blockInfo(beforeBlockNodeEndIndex, blockFirstNode, parent, info) {
        const checkBraseTextEndIndex = this.sourceCode.getIndex(
            blockFirstNode ||
                parent.source.endChildren ||
                parent.source.end ||
                this.sourceEnd
        )
        const checkBrase =
            // skip `)` or `}` or `/*...*/` or spaces and first `{`
            /^(?:\/\*(?:[\s\S]*?)\*\/|\s|\)|\})*\{/u.exec(
                this.sourceCode.getText(
                    beforeBlockNodeEndIndex + 1,
                    checkBraseTextEndIndex - 1
                )
            )
        const hasBrace = Boolean(checkBrase)
        let startIndex = null
        let bodyStartIndex = null
        let openBraceIndex = null
        if (!hasBrace) {
            // stylus style selector
            // e.g
            // ----
            // .foo
            //   color: red
            // ----
            // beforeBlockNodeEndIndex:
            // .foo
            //    ^
            bodyStartIndex = beforeBlockNodeEndIndex + 1
            startIndex = bodyStartIndex
        } else {
            // CSS style selector
            // e.g
            // ----
            // .foo {
            //   color: red
            // }
            // ----
            // beforeBlockNodeEndIndex:
            // .foo {
            //     ^
            openBraceIndex = beforeBlockNodeEndIndex + checkBrase[0].length
            bodyStartIndex = openBraceIndex + 1
            startIndex = openBraceIndex
        }

        const endIndex = this.getBlockEndIndex(bodyStartIndex, parent, {
            hasBrace,
            info,
            openBraceIndex,
        })
        const bodyText = this.sourceCode.text.slice(
            bodyStartIndex,
            endIndex + 1
        )

        let bodyEndIndex = endIndex
        const checkEndBrace = hasBrace && /\}\s*;?\s*$/u.exec(bodyText)
        if (checkEndBrace) {
            bodyEndIndex = endIndex - checkEndBrace[0].length
        }

        const rawAfter = hasBrace
            ? parseRawAfter(this.sourceCode, bodyEndIndex, {
                  blockCommentIsRaw: false,
              })
            : {
                  after: "",
                  stylusAfter: "",
                  inlineComments: [],
              }

        return {
            hasBrace,
            bodyStartIndex,
            bodyEndIndex,
            rawAfter: rawAfter.after,
            rawStylusAfter: rawAfter.stylusAfter,
            afterInlineComments: rawAfter.inlineComments,
            startIndex,
            endIndex,
        }
    }

    getBlockEndIndex(
        _bodyStartIndex,
        parent,
        { hasBrace, openBraceIndex, info }
    ) {
        const parentEndIndex = this.sourceCode.getIndex(
            parent.source.endChildren || parent.source.end || this.sourceEnd
        )
        if (info.next) {
            const nextStartIndex = this.sourceCode.getIndex(info.next)
            if (nextStartIndex <= parentEndIndex) {
                const { startIndex } = parseRawAfter(
                    this.sourceCode,
                    nextStartIndex - 1,
                    {
                        blockCommentIsRaw: false,
                    }
                )
                return startIndex - 1
            }
        }
        if (hasBrace) {
            const closeBraceIndex = this.getCloseBraceIndex(
                openBraceIndex,
                parent
            )
            if (closeBraceIndex != null) {
                return closeBraceIndex
            }
        }

        const { startIndex } = parseRawAfter(this.sourceCode, parentEndIndex, {
            blockCommentIsRaw: false,
        })
        return startIndex - 1
    }

    getCloseBraceIndex(openBraceIndex, parent) {
        const parentEndIndex = this.sourceCode.getIndex(
            parent.source.endChildren || parent.source.end || this.sourceEnd
        )
        const cursor = this.sourceCode.createScopeTokenCursor(openBraceIndex, {
            endLocationIndex: parentEndIndex,
        })
        let token = cursor.next()
        while (token) {
            if (cursor.scopeLevel === 1 && token.value === "}") {
                return token.range[0]
            }
            token = cursor.next()
        }

        return null
    }

    processRawBefore({ last, source: parentSource }, end, parent) {
        let parsedRawBefore = null
        if (last) {
            let prevNode = last
            let endIndex = this.sourceCode.getIndex(
                prevNode.source.rawEnd || prevNode.source.end
            )
            while (prevNode.last) {
                prevNode = prevNode.last
                if (prevNode.source.rawEnd) {
                    endIndex = Math.max(
                        endIndex,
                        this.sourceCode.getIndex(prevNode.source.rawEnd)
                    )
                }
            }
            parsedRawBefore = parseRawBefore(
                this.sourceCode,
                endIndex + 1,
                end && this.sourceCode.getIndex(end)
            )
        } else {
            parsedRawBefore = parseRawBefore(
                this.sourceCode,
                this.sourceCode.getIndex(
                    parentSource.startChildren || parentSource.start
                ),
                end && this.sourceCode.getIndex(end)
            )
        }
        this.pushInlineComments(parent, parsedRawBefore.inlineComments)
        return parsedRawBefore
    }

    pushInlineComments(parent, inlineComments) {
        for (const { token, before, stylusBefore } of inlineComments) {
            const startIndex = token.range[0]
            const endIndex = token.range[1] - 1
            const contents = token.value.replace(/^\/\//gu, "")
            const text = contents.trim()
            const commentSource = {
                start: this.sourceCode.getLoc(startIndex),
                input: this.input,
                end: this.sourceCode.getLoc(endIndex),
            }
            const commentRaws = {
                before,
                left: text ? /^\s*/u.exec(contents)[0] : contents,
                right: text ? /\s*$/u.exec(contents)[0] : "",
                inline: true,
            }
            if (before !== stylusBefore) {
                commentRaws.stylusBefore = stylusBefore
            }

            // Create Rule node
            const comment = postcss.comment()
            comment.parent = parent
            comment.source = commentSource
            comment.raws = commentRaws
            comment.text = text

            parent.nodes.push(comment)
        }
    }
}

module.exports = StylusParser
