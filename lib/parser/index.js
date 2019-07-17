"use strict"

const postcss = require("postcss")
const StylusSourceCode = require("./stylus-source-code")
const parseSelector = require("./parse-selector")
const parseAtRuleNameAndCondition = require("./parse-atrule-name-and-condition")
const parseFunction = require("./parse-function")
const parseProp = require("./parse-prop")
const parseValue = require("./parse-value")
const parseOwnSemi = require("./parse-own-semi")
const parseRawBefore = require("./parse-raw-before")
const parseRawAfter = require("./parse-raw-after")
const parseExpression = require("./parse-expression")

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
    constructor(nodes, index, parentInfo, parent) {
        this._nodes = nodes
        this._index = index
        this._parent = parentInfo
        this._parentNode = parent
    }

    get nodes() {
        return this._nodes
    }

    get nextSibling() {
        return this._nodes[this._index + 1]
    }

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

    get parentNode() {
        return this._parentNode
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
 * Checks if the given node is object block node.
 * @param {StylusNode}
 */
function isObjectProperty(node) {
    return (
        node.nodeName === "property" &&
        node.expr.nodes[0] &&
        node.expr.nodes[0].nodeName === "object"
    )
}

/**
 * Checks if the given node is mixin function node.
 * @param {StylusNode}
 */
function isMixinFunction(node) {
    if (node.nodeName !== "function" || !node.block) {
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
        if (n.nodeName === "if") {
            if (!isAllMixinNodesForIf(n)) {
                return false
            }
        } else if (n.nodeName === "each") {
            if (!isAllMixinNodesForEach(n)) {
                return false
            }
        } else if (n.nodeName === "group") {
            if (!isAllMixinNodesForGroup(n)) {
                return false
            }
        } else if (n.nodeName === "expression") {
            return maybeSelectorExpression(n, nodes)
        } else if (n.nodeName !== "property") {
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
        if (e.nodeName === "block") {
            if (!isAllMixinNodes(e.nodes)) {
                return false
            }
        } else if (e.nodeName === "if") {
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
        if (sel.nodeName !== "selector") {
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
        if (expression.nodes[0].nodeName === "member") {
            const idx = nodes.indexOf(expression)
            for (const n of nodes.slice(idx)) {
                if (n.nodeName === "group") {
                    return n.nodes.some(sel => sel.nodeName === "selector")
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
        const root = postcss.root()
        root.source = {
            input: this.input,
            start: { line: 1, column: 1 },
        }
        // Raws for root node
        root.raws = {
            semicolon: false,
            after: "",
        }

        node.nodes.forEach((n, i) =>
            this.process(
                n,
                root,
                new ProcessInfo(node.nodes, i, undefined, root)
            )
        )

        // raws.semicolon
        const lastAstNode = findLast(root.nodes, n => n.type !== "comment")
        if (lastAstNode) {
            if (isSemiOptNode(lastAstNode)) {
                if (!lastAstNode.omittedSemi) {
                    root.raws.semicolon = true
                } else {
                    delete lastAstNode.omittedSemi
                }
            }
        } else {
            delete root.raws.semicolon
        }

        if (root.last) {
            const rawAfter = parseRawAfter(
                this.sourceCode,
                this.sourceCode.text.length - 1,
                {
                    blockCommentIsRaw: false,
                }
            )
            root.raws.after = rawAfter.after
            if (rawAfter.after !== rawAfter.afterStylus) {
                root.raws.afterStylus = rawAfter.afterStylus
            }
        } else {
            root.raws = {
                after: this.text,
            }
        }
        return root
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    process(node, parent, info) {
        const { nodeName } = node
        if (this[nodeName]) {
            return this[nodeName](node, parent, info) || null
        }
        console.log(`The parsing of \`${nodeName}\` is not implemented yet.`)
        return null
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    group(node, parent, info) {
        node.nodes.forEach((n, i) =>
            this.process(
                n,
                parent,
                new ProcessInfo(node.nodes, i, info, parent)
            )
        )
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    media(node, parent, info) {
        this.atruleImpl(
            node,
            {
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
    atrule(node, parent, info) {
        this.atruleImpl(node, { blockNode: node.block }, parent, info)
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    ternary(node, parent, info) {
        this.atruleImpl(node, {}, parent, info).ternary = true
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
        if (info.nextSibling && info.nextSibling.nodeName === "selector") {
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
        const lastSeg = node.segments[node.segments.length - 1]
        this.ruleImpl(
            node,
            {
                selectorLocations,
                beforeBlockNodeEndIndex: this.sourceCode.getEndIndex(lastSeg),
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
        this.propertyToDecl(node, parent, info)
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    propertyToDecl(node, parent, info) {
        this.declImpl(node, { propStartNode: node.segments[0] }, parent, info)
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    propertyToAtRule(node, parent, info) {
        const objectNode = node.expr.nodes[0]

        let blockFirstNode = null
        for (const key of Object.keys(objectNode.keys)) {
            const keyNode = objectNode.keys[key]
            if (
                !blockFirstNode ||
                this.sourceCode.getIndex(keyNode) <
                    this.sourceCode.getIndex(blockFirstNode)
            ) {
                blockFirstNode = keyNode
            }
        }

        this.atruleImpl(
            node,
            {
                blockFirstNode,
                blockNode: node.expr,
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
    object(node, parent, info) {
        for (const keyNode of Object.keys(node.keys)
            .map(key => node.keys[key])
            .sort((a, b) => {
                const ia = this.sourceCode.getIndex(a)
                const ib = this.sourceCode.getIndex(b)
                if (ia < ib) {
                    return -1
                } else if (ia > ib) {
                    return 1
                }
                return 0
            })) {
            this.declImpl(keyNode, { propStartNode: keyNode }, parent, info)
        }
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    expression(node, parent, info) {
        if (node.isEmpty) {
            this.expressionToEmptyRule(node, parent, info)
            return
        }
        if (maybeSelectorExpression(node, info.nodes)) {
            this.pushSelectorStack(node)
            return
        }
        if (maybeInterpolationExpression(node, this.sourceCode)) {
            // @extend like
            this.expressionToAtRule(node, parent, info).expression = true
            return
        }
        if (node.nodes.length === 1) {
            const first = node.nodes[0]
            const { nodeName } = first
            if (nodeName === "call") {
                this.atruleImpl(node, {}, parent, info).call = true
                return
            }
            if (nodeName === "binop") {
                this.atruleImpl(node, {}, parent, info).binop = true
                return
            }
            if (nodeName === "member") {
                this.atruleImpl(node, {}, parent, info).member = true
                return
            }
        }
        console.log(
            `Unknown expression type: ${node.nodes[0] &&
                node.nodes[0].nodeName}`,
            node,
            this.sourceCode.getText(
                this.sourceCode.getIndex(node) - 3,
                this.sourceCode.getIndex(node) + 10
            ),
            this.input.file
        )
        this.atruleImpl(first, {}, parent, info)
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    expressionToEmptyRule(node, parent, _info) {
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
            beforeStylus: rawBeforeStylus,
        } = this.getRawBefore(parent)
        const ruleRaws = {
            before: rawBefore,
            between: "",
            after: parsedExpression.expression,
        }
        if (rawBefore !== rawBeforeStylus) {
            ruleRaws.beforeStylus = rawBeforeStylus
        }
        const rawExpression = raw(
            parsedExpression.expression,
            parsedExpression.raw.expressionStylus,
            parsedExpression.raw.expression
        )
        if (rawExpression.raw) {
            ruleRaws.after = rawExpression.raw
            if (rawExpression.raw !== rawExpression.stylus) {
                ruleRaws.afterStylus = rawExpression.stylus
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

    expressionToAtRule(node, parent, _info) {
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
            beforeStylus: rawBeforeStylus,
        } = this.getRawBefore(parent)
        const atRuleRaws = {
            before: rawBefore,
            between: "",
            afterName: "",
        }
        if (rawBefore !== rawBeforeStylus) {
            atRuleRaws.beforeStylus = rawBeforeStylus
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
    ident(node, parent, info) {
        const valNodeName = node.val.nodeName
        if (
            valNodeName === "expression" &&
            node.val.nodes[0] &&
            node.val.nodes[0].nodeName === "atblock"
        ) {
            this.declImpl(
                node,
                { propStartNode: node, atblock: node.val.nodes[0] },
                parent,
                info
            ).assignment = true
        } else if (valNodeName === "function") {
            this.function(node.val, parent, info)
        } else if (valNodeName === "expression" || valNodeName === "null") {
            this.declImpl(
                node,
                { propStartNode: node },
                parent,
                info
            ).assignment = true
        } else if (valNodeName === "binop") {
            this.atruleImpl(node, {}, parent, info).binop = true
        } else {
            console.log(`Unknown ident val type \`${valNodeName}\``)
        }
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    function(node, parent, info) {
        if (isMixinFunction(node)) {
            this.atruleImpl(
                node,
                { blockNode: node.block },
                parent,
                info
            ).mixin = true
        } else {
            this.atruleFunctionImpl(
                node,
                { blockNode: node.block },
                parent,
                info
            )
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
            { blockNode: node.block },
            parent,
            info
        ).binop = true
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
        this.atruleImpl(
            node,
            { blockNode: node.block, postfix },
            parent,
            info
        ).each = true
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    if(node, parent, info) {
        const nodes = [node, ...node.elses]

        this.atruleImpl(
            node,
            { blockNode: node.block, postfix: node.postfix },
            parent,
            new ProcessInfo(nodes, 0, info, parent)
        ).if = true

        node.elses.forEach((el, i) => {
            this.atruleImpl(
                el,
                { blockNode: el },
                parent,
                new ProcessInfo(nodes, i + 1, info, parent)
            ).else = true
        })
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
            beforeStylus: rawBeforeStylus,
        } = this.getRawBefore(
            parent,
            this.sourceCode.getIndex(commentSource.start) - 1
        )
        const commentRaws = {
            before: rawBefore,
            left: text ? /^\s*/u.exec(contents)[0] : contents,
            right: text ? /\s*$/u.exec(contents)[0] : "",
        }
        if (rawBefore !== rawBeforeStylus) {
            commentRaws.beforeStylus = rawBeforeStylus
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
     * @param {StylusNode} node
     * @param {*} infomation
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    atruleImpl(node, { blockFirstNode, blockNode, postfix }, parent, info) {
        /* eslint-enable complexity */
        const startIndex = this.sourceCode.getIndex(node)
        const parsedNameAndCondition = parseAtRuleNameAndCondition(
            this.sourceCode,
            startIndex,
            parent.postfix
                ? this.sourceCode.getIndex(parent.source.start) -
                  (parent.raws.postfixBefore
                      ? parent.raws.postfixBefore.length
                      : 0) -
                  1
                : blockNode && !postfix && blockNode.nodes && blockNode.nodes[0]
                    ? this.sourceCode.getIndex(blockNode.nodes[0])
                    : undefined
        )
        let atRuleSource = null
        let atRuleRaws = null
        let pythonic = false
        if (blockNode && !postfix) {
            // block
            const {
                hasBrace,
                bodyStartIndex,
                bodyEndIndex,
                rawAfter,
                rawAfterStylus,
                endIndex,
            } = this.blockInfo(
                parsedNameAndCondition.endIndex,
                blockFirstNode || blockNode.nodes[0],
                parent,
                info
            )

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
                if (rawAfter !== rawAfterStylus) {
                    atRuleRaws.afterStylus = rawAfterStylus
                }
            }
            const { ownSemicolon } = parseOwnSemi(this.sourceCode, endIndex)
            if (ownSemicolon) {
                atRuleRaws.ownSemicolon = ownSemicolon
            }
            pythonic = !hasBrace
            // } else if (postfix) {
        } else {
            atRuleSource = {
                start: this.sourceCode.getLoc(startIndex),
                input: this.input,
                end: this.sourceCode.getLoc(parsedNameAndCondition.endIndex),
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
        let {
            before: rawBefore,
            beforeStylus: rawBeforeStylus,
        } = this.getRawBefore(parent)
        if (postfix) {
            const {
                after: postfixBefore,
                afterStylus: postfixBeforeStylus,
            } = parseRawAfter(this.sourceCode, startIndex - 1)
            rawBefore = ""
            rawBeforeStylus = ""
            atRuleRaws.postfixBefore = postfixBefore
            if (postfixBefore !== postfixBeforeStylus) {
                atRuleRaws.postfixBeforeStylus = postfixBeforeStylus
            }
        } else if (parent.postfix) {
            const blockParent = info.parent.parentNode
            const parentIndex = blockParent.nodes.indexOf(parent)
            ;({
                before: rawBefore,
                beforeStylus: rawBeforeStylus,
            } = this.getRawBefore({
                last: blockParent.nodes[parentIndex - 1],
                source: blockParent.source,
            }))
        }
        atRuleRaws.before = rawBefore
        if (rawBefore !== rawBeforeStylus) {
            atRuleRaws.beforeStylus = rawBeforeStylus
        }

        if (
            parsedNameAndCondition.raw.between !==
            parsedNameAndCondition.raw.betweenStylus
        ) {
            atRuleRaws.betweenStylus = parsedNameAndCondition.raw.betweenStylus
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
                this.process(
                    n,
                    atRule,
                    new ProcessInfo(childNodes, i, info, atRule)
                )
            )
        }
        if (atRule.nodes && !postfix) {
            // raws.semicolon
            const lastAstNode = findLast(
                atRule.nodes,
                n => n.type !== "comment"
            )
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
        } else if (!parsedNameAndCondition.raw.semicolon) {
            atRule.omittedSemi = true
        }
        return atRule
    }

    /**
     * @param {StylusNode} node
     * @param {*} infomation
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    atruleFunctionImpl(node, _opt, parent, info) {
        const startIndex = this.sourceCode.getIndex(node)
        const endIndex = this.getBlockEndIndex(startIndex, parent, info)
        const parsedFunction = parseFunction(
            this.sourceCode,
            startIndex,
            endIndex
        )

        const atRuleSource = {
            start: this.sourceCode.getLoc(startIndex),
            input: this.input,
            end: this.sourceCode.getLoc(parsedFunction.endIndex),
        }
        const atRuleRaws = {
            before: undefined,
            between: parsedFunction.raw.between,
            afterName: parsedFunction.raw.afterName,
        }

        const {
            before: rawBefore,
            beforeStylus: rawBeforeStylus,
        } = this.getRawBefore(parent)
        atRuleRaws.before = rawBefore
        if (rawBefore !== rawBeforeStylus) {
            atRuleRaws.beforeStylus = rawBeforeStylus
        }

        if (parsedFunction.raw.between !== parsedFunction.raw.betweenStylus) {
            atRuleRaws.betweenStylus = parsedFunction.raw.betweenStylus
        }
        const rawParams = raw(
            parsedFunction.params,
            parsedFunction.raw.stylus,
            parsedFunction.raw.css
        )
        if (rawParams.raw) {
            atRuleRaws.params = rawParams
        }
        const rawBody = raw(
            parsedFunction.body,
            parsedFunction.raw.body.stylus,
            parsedFunction.raw.body.css
        )
        if (rawBody.raw) {
            atRuleRaws.body = rawBody
        }
        if (parsedFunction.raw.identifier !== "@") {
            atRuleRaws.identifier = parsedFunction.raw.identifier
        }

        // Create Rule node
        const atRule = postcss.atRule()
        atRule.name = parsedFunction.name
        atRule.source = atRuleSource
        atRule.params = parsedFunction.params
        atRule.raws = atRuleRaws
        // Stylus property
        atRule.function = true
        atRule.body = parsedFunction.body
        parent.nodes.push(atRule)
        if (!parsedFunction.raw.semicolon) {
            atRule.omittedSemi = true
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
            rawAfterStylus,
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
            beforeStylus: rawBeforeStylus,
        } = this.getRawBefore(parent)

        const ruleRaws = {
            before: rawBefore,
            between: parsedSelector.raw.between,
            semicolon: false,
            selector: undefined,
            after: "",
        }
        if (rawBefore !== rawBeforeStylus) {
            ruleRaws.beforeStylus = rawBeforeStylus
        }
        if (parsedSelector.raw.between !== parsedSelector.raw.betweenStylus) {
            ruleRaws.betweenStylus = parsedSelector.raw.betweenStylus
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
            if (rawAfter !== rawAfterStylus) {
                ruleRaws.afterStylus = rawAfterStylus
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
            this.process(
                n,
                rule,
                new ProcessInfo(blockNode.nodes, i, info, rule)
            )
        )

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

    declImpl(node, { propStartNode, atblock }, parent, info) {
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
                minEnd: atblock
                    ? this.sourceCode.getIndex(
                          atblock.nodes[atblock.nodes.length - 1]
                      )
                    : undefined,
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

        let {
            before: rawBefore,
            beforeStylus: rawBeforeStylus,
        } = this.getRawBefore(parent)
        if (parent.postfix) {
            const blockParent = info.parent.parentNode
            const parentIndex = blockParent.nodes.indexOf(parent)
            ;({
                before: rawBefore,
                beforeStylus: rawBeforeStylus,
            } = this.getRawBefore({
                last: blockParent.nodes[parentIndex - 1],
                source: blockParent.source,
            }))
        }

        const declRaws = {
            before: rawBefore,
            // after: "",
            between: parsedValue.raw.between,
        }

        if (rawBefore !== rawBeforeStylus) {
            declRaws.beforeStylus = rawBeforeStylus
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
        if (parsedValue.raw.between !== parsedValue.raw.betweenStylus) {
            decl.raws.betweenStylus = parsedValue.raw.betweenStylus
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
            const braceIndex = beforeBlockNodeEndIndex + checkBrase[0].length
            bodyStartIndex = braceIndex + 1
            startIndex = braceIndex
        }

        const endIndex = this.getBlockEndIndex(bodyStartIndex, parent, info)
        const bodyText = this.sourceCode.getText(bodyStartIndex, endIndex)

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
                  afterStylus: "",
              }

        return {
            hasBrace,
            bodyStartIndex,
            bodyEndIndex,
            rawAfter: rawAfter.after,
            rawAfterStylus: rawAfter.afterStylus,
            startIndex,
            endIndex,
        }
    }

    getBlockEndIndex(_bodyStartIndex, parent, info) {
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
        const { startIndex } = parseRawAfter(this.sourceCode, parentEndIndex, {
            blockCommentIsRaw: false,
        })
        return startIndex - 1
    }

    getRawBefore({ last, source: parentSource }, end) {
        if (last) {
            return parseRawBefore(
                this.sourceCode,
                this.sourceCode.getIndex(last.source.end) + 1,
                end && this.sourceCode.getIndex(end)
            )
        }
        return parseRawBefore(
            this.sourceCode,
            this.sourceCode.getIndex(
                parentSource.startChildren || parentSource.start
            ),
            end && this.sourceCode.getIndex(end)
        )
    }
}

module.exports = StylusParser
