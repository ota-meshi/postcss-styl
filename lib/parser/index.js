"use strict"

const postcss = require("postcss")
const StylusSourceCode = require("./stylus-source-code")
const { extractTexts, extractText } = require("./text")
const parseSelector = require("./parse-selector")
const parseAtRuleNameAndCondition = require("./parse-atrule-name-and-condition")
const parseValue = require("./parse-value")

const DEFAULT_RAWS_ROOT = {
    before: "",
}

const DEFAULT_RAWS_RULE = {
    before: "",
    between: "",
}

const DEFAULT_RAWS_DECL = {
    before: "",
    between: "",
    semicolon: false,
}

const DEFAULT_COMMENT_DECL = {
    before: "",
    left: "",
    right: "",
}

/**
 * Checks wether node is variable declaration
 * @param {StylusNode} node
 * @return {Boolean}
 */
function isVariableNode(node) {
    return (
        node.__type === "Ident" &&
        Boolean(node.val) &&
        node.val.__type === "Expression"
    )
}

/**
 * Checks wether node is function declaration
 * @param {StylusNode} node
 * @return {Boolean}
 */
function isFunctionNode(node) {
    return (
        node.__type === "Ident" &&
        Boolean(node.val) &&
        node.val.__type === "Function"
    )
}

/**
 * Checks wether node is selector node
 * @param {StylusNode} node
 * @return {Boolean}
 */
function isSelectorNode(node) {
    return node.__type === "Selector"
}

/**
 * Checks wether node is selector call node e.g.:
 * {mySelectors}
 * @param {StylusNode} node
 * @return {Boolean}
 */
function isSelectorCallNode(node) {
    return node.__type === "Call" && node.name === "Selector"
}

/**
 * Checks wether node is at rule
 * @param {StylusNode} node
 * @return {Boolean}
 */
function isAtRuleNode(node) {
    return (
        [
            "Media",
            "Keyframes",
            "Atrule",
            "Import",
            "Require",
            "Supports",
            "Literal",
        ].indexOf(node.__type) !== -1
    )
}

/**
 * Checks wether node contains color
 * @param {StylusNode} node
 * @return {Boolean}
 */
function isColor(node) {
    if (node.__type === "Ident" && cssColors.indexOf(node.name) >= 0) {
        return true
    }
    if (node.__type === "Rgba") {
        return true
    }
    if (
        node.__type === "Call" &&
        ["rgb", "rgba", "hsl", "hsla"].indexOf(node.name) >= 0
    ) {
        return true
    }
    return false
}

/**
 * Find `!important` node
 */
function findImportentNode(sourceCode, valueNodes) {
    let index = valueNodes.length - 1
    for (; index >= 0; index--) {
        const node = valueNodes[index]
        if (node.nodeName === "comment") {
            continue
        }
        if (node.nodeName === "unaryop" && node.op === "!") {
            const text = extractText(sourceCode, node.expr)
            if (text.toLowerCase() === "important") {
                return node
            }
        }
        const text = extractText(sourceCode, node)
        if (text.toLowerCase() === "important") {
            break
        }
        if (text.toLowerCase() === "!important") {
            return node
        }

        return null
    }
    index--
    for (; index >= 0; index--) {
        const node = valueNodes[index]
        if (node.nodeName === "comment") {
            continue
        }
        if (node.nodeName === "unaryop" && node.op === "!") {
            if (node.expr.nodeName === "comment") {
                return node
            }
        }
        return null
    }
    return null
}

/**
 * build raw
 * @param {string} value
 * @param {string} stylus
 * @param {string} rawCss
 */
function raw(value, rawStylus, rawCss) {
    const ret = { value }
    if (rawStylus !== value) {
        ret.raw =
            rawCss ||
            rawStylus.replace(/\/\/(.*)(\r\n|[\r\n]|$)/gmu, m => `/*${m[1]}*/`)
        if (ret.raw !== rawStylus) {
            ret.stylus = rawStylus
        }
    }

    return ret
}

/**
 * Parse after spaces
 * @param {string} s given test
 */
function parseSpaceAfter(s, { allowComment = false } = {}) {
    let comment = false
    for (let index = s.length - 1; index >= 0; index--) {
        const c = s[index]
        if (comment) {
            if (c === "*" && s[index - 1] === "/") {
                comment = false
                index--
            }
        } else {
            if (!allowComment && c === "/" && s[index - 1] === "*") {
                index--
                comment = true
                continue
            } else if (!c.trim()) {
                continue
            }
            return {
                value: s.slice(0, index + 1),
                after: s.slice(index + 1),
            }
        }
    }
    return {
        value: "",
        after: s,
    }
}

/**
 * Parse before spaces
 * @param {string} s given test
 */
function parseSpaceBefore(s, { allowComment = false } = {}) {
    let comment = false
    for (let index = 0; index < s.length; index++) {
        const c = s[index]
        if (comment) {
            if (c === "*" && s[index + 1] === "/") {
                comment = false
                index++
            }
        } else {
            if (!allowComment && c === "/" && s[index + 1] === "*") {
                index++
                comment = true
                continue
            } else if (!c.trim()) {
                continue
            }
            return {
                value: s.slice(index),
                before: s.slice(0, index),
            }
        }
    }
    return {
        value: "",
        before: s,
    }
}

/**
 * Parse spaces
 * @param {string} s given test
 */
function parseSpaces(s, option) {
    const b = parseSpaceBefore(s, option)
    const a = parseSpaceAfter(b.value, option)
    return {
        before: b.before,
        value: a.value,
        after: a.after,
    }
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
            // TODO
            console.warn(error)
            throw this.input.error(error.message, error.lineno, error.column)
        }

        try {
            this.root = this.stylesheet(this.node)
        } catch (error) {
            // TODO
            console.warn(error)
            throw error
        }
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
            this.process(n, root, new ProcessInfo(node.nodes, i))
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
            root.raws.after = this.sourceCode.getText(
                root.last
                    ? this.sourceCode.getIndex(root.last.source.end) + 1
                    : root.source.start
            )
        } else {
            root.raws = {
                after: this.text,
            }
        }
        return root
    }

    /**
     *
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    process(node, parent, info) {
        if (this[node.nodeName]) {
            return this[node.nodeName](node, parent, info) || null
        }
        console.log(node.nodeName)
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
        this.atruleImpl(node, parent, info)
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    charset(node, parent, info) {
        this.atruleImpl(node, parent, info)
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    supports(node, parent, info) {
        this.atruleImpl(node, parent, info)
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    import(node, parent, info) {
        this.atruleImpl(node, parent, info)
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    atrule(node, parent, info) {
        this.atruleImpl(node, parent, info)
    }

    /**
     * @param {StylusNode} node
     * @param {*} infomation
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    atruleImpl(node, parent, info) {
        const startIndex = this.sourceCode.getIndex(node)
        const parsedNameAndCondition = parseAtRuleNameAndCondition(
            this.sourceCode,
            startIndex
        )
        let atRuleSource = null
        let atRuleRaws = null
        let pythonic = false
        if (node.block) {
            // block
            const {
                hasBrace,
                bodyStartIndex,
                bodyEndIndex,
                rawAfter,
                endIndex,
            } = this.blockInfo(
                parsedNameAndCondition.endIndex,
                node.block.nodes[0],
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
            }
            pythonic = !hasBrace
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
        }
        const { rawBefore } = this.getRawBefore(parent, atRuleSource.start)
        atRuleRaws.before = rawBefore

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
        parent.nodes.push(atRule)

        if (node.block && node.block.nodes) {
            atRule.nodes = []
            node.block.nodes.forEach((n, i) =>
                this.process(
                    n,
                    atRule,
                    new ProcessInfo(node.block.nodes, i, info)
                )
            )
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
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    selector(node, parent, info) {
        if (info.nextSibling && info.nextSibling.nodeName === "selector") {
            const stack = this._selectorsStack || (this._selectorsStack = [])
            stack.push(node)
            return
        }

        let selectors = [node]
        if (this._selectorsStack) {
            selectors = [...this._selectorsStack, node]
            delete this._selectorsStack
        }

        const lastSeg = node.segments[node.segments.length - 1]

        // block
        const {
            hasBrace,
            bodyStartIndex,
            bodyEndIndex,
            rawAfter,
            startIndex: blockStartIndex,
            endIndex,
        } = this.blockInfo(
            this.sourceCode.getEndIndex(lastSeg),
            node.block.nodes[0],
            parent,
            info
        )

        // raws
        const selectorLocations = selectors.map((selector, index) => {
            // start location
            const selectorStartIndex = this.sourceCode.getIndex(selector)

            // calc end location
            let selectorEndIndex = undefined
            const nextSelector = selectors[index + 1]
            if (selectors[index + 1]) {
                selectorEndIndex = this.sourceCode.getIndex(nextSelector) - 1
            } else {
                selectorEndIndex = blockStartIndex - 1
            }
            return [selectorStartIndex, selectorEndIndex]
        })
        const parsedSelector = parseSelector(this.sourceCode, selectorLocations)

        // location
        const first = selectors[0]
        const ruleSource = {
            start: this.sourceCode.getLoc(first),
            startChildren: this.sourceCode.getLoc(bodyStartIndex),
            input: this.input,
            end: this.sourceCode.getLoc(endIndex),
        }

        const { rawBefore } = this.getRawBefore(parent, ruleSource.start)
        const ruleRaws = {
            before: rawBefore,
            between: parsedSelector.raw.between,
            semicolon: false,
            selector: undefined,
            after: "",
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

        node.block.nodes.forEach((n, i) =>
            this.process(n, rule, new ProcessInfo(node.block.nodes, i, info))
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
    }

    blockInfo(beforeBlockNodeEndIndex, blockFirstNode, parent, info) {
        const checkBraseTextEndIndex = this.sourceCode.getIndex(
            blockFirstNode ||
                parent.source.endChildren ||
                parent.source.end ||
                this.sourceEnd
        )
        const checkBrase =
            // skip `)` or `/*...*/` or spaces and first `{`
            /^(?:\/\*(?:[\s\S]*?)\*\/|\s|\))*\{/u.exec(
                this.sourceCode.getText(
                    beforeBlockNodeEndIndex + 1,
                    checkBraseTextEndIndex
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

        let bodyText = null
        const parentEndIndex = this.sourceCode.getIndex(
            parent.source.endChildren || parent.source.end || this.sourceEnd
        )
        if (info.next) {
            const nextStartIndex = this.sourceCode.getIndex(info.next)
            if (nextStartIndex <= parentEndIndex) {
                bodyText = parseSpaceAfter(
                    this.sourceCode.getText(bodyStartIndex, nextStartIndex - 1)
                ).value
            }
        }
        if (bodyText == null) {
            bodyText = parseSpaceAfter(
                this.sourceCode.getText(bodyStartIndex, parentEndIndex)
            ).value
        }

        const endIndex = bodyStartIndex + bodyText.length - 1

        let bodyEndIndex = endIndex
        const checkEndBrace = hasBrace && /\}\s*;?\s*$/u.exec(bodyText)
        if (checkEndBrace) {
            bodyEndIndex = endIndex - checkEndBrace[0].length
        }
        const rawAfter = hasBrace
            ? parseSpaceAfter(
                  this.sourceCode.getText(bodyStartIndex, bodyEndIndex),
                  { allowComment: true }
              ).after
            : ""

        return {
            hasBrace,
            bodyStartIndex,
            bodyEndIndex,
            rawAfter,
            startIndex,
            endIndex,
        }
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    property(node, parent, info) {
        if (isObjectProperty(node)) {
            this.propertyToRule(node, parent, info)
        } else {
            this.propertyToDecl(node, parent, info)
        }
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    propertyToDecl(node, parent, _info) {
        const prop = this.extractValueText(node.segments)

        const lastPropNode = node.segments[node.segments.length - 1]
        const parsedValue = parseValue(
            this.sourceCode,
            this.sourceCode.getEndIndex(lastPropNode) + 1
        )

        // location
        const startIndex = this.sourceCode.getIndex(node)

        const declSource = {
            start: this.sourceCode.getLoc(startIndex),
            input: this.input,
            end: this.sourceCode.getLoc(parsedValue.endIndex),
        }

        const { rawBefore } = this.getRawBefore(parent, declSource.start)
        const declRaws = {
            before: rawBefore,
            // after: "",
            between: parsedValue.raw.between,
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
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    propertyToRule(node, parent, info) {
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

        // block
        const {
            hasBrace,
            bodyStartIndex,
            bodyEndIndex,
            rawAfter,
            startIndex: blockStartIndex,
            endIndex,
        } = this.blockInfo(
            this.sourceCode.getIndex(node.expr),
            blockFirstNode,
            parent,
            info
        )

        // raws
        const selectorLocation = [
            this.sourceCode.getIndex(node),
            blockStartIndex - 1,
        ]
        const parsedSelector = parseSelector(this.sourceCode, [
            selectorLocation,
        ])

        // location
        const ruleSource = {
            start: this.sourceCode.getLoc(node),
            startChildren: this.sourceCode.getLoc(bodyStartIndex),
            input: this.input,
            end: this.sourceCode.getLoc(endIndex),
        }

        const { rawBefore } = this.getRawBefore(parent, ruleSource.start)
        const ruleRaws = {
            before: rawBefore,
            between: parsedSelector.raw.between,
            semicolon: false,
            selector: undefined,
            after: "",
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

        node.expr.nodes.forEach((n, i) =>
            this.process(n, rule, new ProcessInfo(node.expr.nodes, i, info))
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
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    expression(node, parent, _info) {
        if (!node.isEmpty) {
            // ?
            return
        }
        const startIndex = this.sourceCode.getIndex(node)
        const endIndex = this.sourceCode.getEndIndex(node)
        const text = this.sourceCode.getText(startIndex, endIndex)
        if (!/^\{[\s\S]*\}$/u.test(text)) {
            // ?
            return
        }

        // empty rule

        const ruleSource = {
            start: this.sourceCode.getLoc(startIndex),
            input: this.input,
            end: this.sourceCode.getLoc(endIndex),
        }
        const ruleRaws = {
            before: "",
            between: "",
            after: "",
        }

        // Create Rule node
        const rule = postcss.rule()
        rule.parent = parent
        rule.source = ruleSource
        rule.selector = ""
        rule.raws = ruleRaws
        parent.nodes.push(rule)
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    comment(node, parent, _info) {
        const spaces = parseSpaces(node.str.replace(/^\/\*|\*\/$/gu, ""))
        const text = spaces.value
        const startIndex = this.sourceCode.getIndex(node)
        const endIndex = this.sourceCode.getEndIndex(node)

        const commentSource = {
            start: this.sourceCode.getLoc(startIndex),
            input: this.input,
            end: this.sourceCode.getLoc(endIndex),
        }

        const { rawBefore } = this.getRawBefore(parent, commentSource.start)
        const commentRaws = {
            before: rawBefore,
            left: spaces.before,
            right: spaces.after,
        }

        // Create Rule node
        const comment = postcss.comment()
        comment.parent = parent
        comment.source = commentSource
        comment.raws = commentRaws
        comment.text = text
        // Stylus property

        parent.nodes.push(comment)
    }

    getRawBefore(parent, nodeStartLoc) {
        const { last } = parent
        let rawBefore = ""
        if (last) {
            rawBefore = this.sourceCode.getText(
                this.sourceCode.getIndex(last.source.end) + 1,
                this.sourceCode.getIndex(nodeStartLoc) - 1
            )
        } else {
            rawBefore = this.sourceCode.getText(
                parent.source.startChildren || parent.source.start,
                this.sourceCode.getIndex(nodeStartLoc) - 1
            )
        }

        return { rawBefore }
    }

    /**
     * The string from nodes
     * @param {StylusNode[]} nodes nodes
     * @returns {string} text
     */
    extractValueText(nodes) {
        let result = ""
        for (const t of extractTexts(this.sourceCode, nodes, {
            skipComment: true,
        })) {
            result += t
        }
        return result
    }

    /**
     * The string from nodes
     * @param {StylusNode[]} nodes nodes
     * @returns {string} text
     */
    extractRawText(nodes) {
        let result = ""
        for (const t of extractTexts(this.sourceCode, nodes)) {
            result += t
        }
        return result
    }
}

module.exports = StylusParser
