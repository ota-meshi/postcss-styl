"use strict"

const postcss = require("postcss")
const StylusSourceCode = require("./stylus-source-code")
const { extractTexts, extractText } = require("./text")

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
        const beforeBlockNodeEndIndex = this.sourceCode.getEndIndex(node.val)
        this.atruleImpl(node, { beforeBlockNodeEndIndex }, parent, info)
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    charset(node, parent, info) {
        const beforeBlockNodeEndIndex = this.sourceCode.getEndIndex(node.val)
        this.atruleImpl(node, { beforeBlockNodeEndIndex }, parent, info)
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    supports(node, parent, info) {
        const beforeBlockNodeEndIndex = this.sourceCode.getEndIndex(
            node.condition
        )
        this.atruleImpl(node, { beforeBlockNodeEndIndex }, parent, info)
    }

    /**
     * @param {StylusNode} node
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    atrule(node, parent, info) {
        const firstNode = node
        const lastSeg = node.segments[node.segments.length - 1]

        const beforeBlockNodeEndIndex = lastSeg
            ? this.sourceCode.getEndIndex(lastSeg)
            : this.sourceCode.getIndex(node) + 1 /* @ */ + node.type.length - 1

        this.atruleImpl(
            node,
            { first: firstNode, beforeBlockNodeEndIndex },
            parent,
            info
        )
    }

    /**
     * @param {StylusNode} node
     * @param {*} infomation
     * @param {PostCssNode} parent
     * @param {ProcessInfo} info
     */
    atruleImpl(node, { beforeBlockNodeEndIndex }, parent, info) {
        const name = node.type || node.nodeName

        const startIndex = this.sourceCode.getIndex(node)
        let atRuleSource = null
        let atRuleRaws = null
        let params = null
        let pythonic = false
        if (node.block) {
            // block
            const {
                hasBrace,
                bodyStartIndex,
                bodyEndIndex,
                rawAfter,
                startIndex: blockStartIndex,
                endIndex,
            } = this.blockInfo(
                beforeBlockNodeEndIndex,
                node.block,
                parent,
                info
            )

            const paramsAndSpaces = parseSpaces(
                this.sourceCode.getText(
                    startIndex + 1 /* @ */ + name.length,
                    blockStartIndex - 1
                )
            )

            const rawAfterName = paramsAndSpaces.before
            params = paramsAndSpaces.value
            const rawBetween = paramsAndSpaces.after

            // location
            atRuleSource = {
                start: this.sourceCode.getLoc(startIndex),
                startChildren: this.sourceCode.getLoc(bodyStartIndex),
                input: this.input,
                end: this.sourceCode.getLoc(endIndex),
            }
            atRuleRaws = {
                before: undefined,
                between: rawBetween,
                afterName: rawAfterName,
                semicolon: false,
                after: "",
            }
            if (hasBrace && bodyEndIndex < endIndex) {
                atRuleSource.endChildren = this.sourceCode.getLoc(bodyEndIndex)
                atRuleRaws.after = rawAfter
            }
            pythonic = !hasBrace
        } else {
            const paramsAndSpaces = parseSpaceBefore(
                this.sourceCode.getText(
                    startIndex + 1 /* @ */ + name.length,
                    beforeBlockNodeEndIndex
                )
            )

            const rawAfterName = paramsAndSpaces.before
            params = paramsAndSpaces.value

            // location
            atRuleSource = {
                start: this.sourceCode.getLoc(startIndex),
                input: this.input,
                end: this.sourceCode.getLoc(beforeBlockNodeEndIndex),
            }
            atRuleRaws = {
                before: undefined,
                afterName: rawAfterName,
                semicolon: false,
                after: "",
            }
        }

        const { rawBefore } = this.getRawBefore(parent, atRuleSource.start)
        atRuleRaws.before = rawBefore

        // Create Rule node
        const atRule = postcss.atRule()
        atRule.name = name
        atRule.source = atRuleSource
        atRule.params = params
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
                if (lastAstNode.type === "decl") {
                    if (!lastAstNode.omittedSemi) {
                        atRule.raws.semicolon = true
                    } else {
                        delete lastAstNode.omittedSemi
                    }
                }
            } else {
                delete atRule.raws.semicolon
            }
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

        const ruleSelector = selectors
            .map(sel => this.extractValueText(sel.segments))
            .join(",")
            .trim()

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
            node.block,
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
        const rawSelectorTexts = selectorLocations.map(loc =>
            this.sourceCode.getText(...loc)
        )

        const lastSelectorIndex = selectorLocations.length - 1

        let rawBetween = ""

        if (hasBrace) {
            const lastSelectorAfterParsed = parseSpaceAfter(
                rawSelectorTexts[lastSelectorIndex]
            )
            if (lastSelectorAfterParsed.after) {
                rawSelectorTexts[lastSelectorIndex] =
                    lastSelectorAfterParsed.value
                rawBetween = lastSelectorAfterParsed.after
            }
        }

        const rawStylusSelector = rawSelectorTexts.join("")
        const rawCssSelector = rawSelectorTexts.reduce((r, t) => {
            if (!r || /,\s*$/u.test(r)) {
                return r + t
            }
            return `${r},${t}`
        }, "")

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
            between: rawBetween,
            semicolon: false,
            selector: undefined,
            after: "",
        }

        const rawSelector = raw(ruleSelector, rawStylusSelector, rawCssSelector)
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
        rule.selector = ruleSelector
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
            if (lastAstNode.type === "decl" && !lastAstNode.omittedSemi) {
                rule.raws.semicolon = true
            } else {
                delete lastAstNode.omittedSemi
                rule.raws.semicolon = false
            }
        } else {
            delete rule.raws.semicolon
        }
    }

    blockInfo(beforeBlockNodeEndIndex, block, parent, info) {
        const checkBrase =
            // skip `)` or `/*...*/` or spaces and first `{`
            /^(?:\/\*(?:[\s\S]*?)\*\/|\s|\))*\{/u.exec(
                this.sourceCode.getText(
                    beforeBlockNodeEndIndex + 1,
                    block.nodes[0] ||
                        parent.source.endChildren ||
                        parent.source.end ||
                        this.sourceEnd
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
        if (hasBrace && bodyText.endsWith("}")) {
            bodyEndIndex = endIndex - 1
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
    property(node, parent, _info) {
        const importantNode = findImportentNode(
            this.sourceCode,
            node.expr.nodes
        )
        const valueNodes = node.expr.nodes.slice(
            node.expr.nodes.findIndex(expr => expr.nodeName !== "comment"),
            importantNode
                ? node.expr.nodes.indexOf(importantNode)
                : node.expr.nodes.length
        )
        const prop = this.extractValueText(node.segments)
        const valueCandidate = this.extractValueText(valueNodes)
        const value = importantNode
            ? valueCandidate.replace(/\s+$/u, "")
            : valueCandidate

        const lastPropNode = node.segments[node.segments.length - 1]
        const lastNode = node.expr.nodes[node.expr.nodes.length - 1]
        const firstValueNode = valueNodes[0]

        // location
        const startIndex = this.sourceCode.getIndex(node)
        const lastNodeEndIndex = this.sourceCode.getEndIndex(lastNode)
        let endIndex = lastNodeEndIndex
        let beforeSemiIndex = endIndex
        const beforeSemi = /^\s*;/u.exec(
            this.sourceCode.getText(lastNodeEndIndex + 1)
        )
        const hasSemi = Boolean(beforeSemi)
        if (beforeSemi) {
            endIndex += beforeSemi[0].length
            beforeSemiIndex = endIndex - 1
        }

        // raws
        const afterPropIndex = this.sourceCode.getEndIndex(lastPropNode) + 1
        const rawBetweenStylus = this.sourceCode.getText(
            afterPropIndex,
            this.sourceCode.getIndex(firstValueNode) - 1
        )
        const hasColon = /^\s*:/u.test(rawBetweenStylus)
        const rawBetween = hasColon ? rawBetweenStylus : `:${rawBetweenStylus}`

        let rawImportant = undefined
        let rawCssValue = ""
        let rawStylusValue = ""
        if (importantNode) {
            const valuesEndIndex = this.sourceCode.getEndIndex(
                valueNodes[valueNodes.length - 1]
            )
            rawCssValue = this.extractRawText(valueNodes)
            rawStylusValue = this.sourceCode.getText(
                firstValueNode,
                valuesEndIndex
            )
            const valueAfterSpaces = /\s*$/u.exec(rawCssValue)[0]
            if (valueAfterSpaces) {
                rawCssValue = rawCssValue.slice(0, -valueAfterSpaces.length)
                rawStylusValue = rawStylusValue.replace(/\s+$/u, "")
            }

            const importantPrefixText =
                valueAfterSpaces +
                this.sourceCode.getText(
                    valuesEndIndex + 1,
                    this.sourceCode.getIndex(importantNode) - 1
                )
            rawImportant =
                importantPrefixText +
                this.sourceCode.getText(importantNode, beforeSemiIndex)
            if (rawImportant === " !important") {
                rawImportant = undefined
            }
        } else {
            rawCssValue =
                this.extractRawText(valueNodes) +
                this.sourceCode.getText(lastNodeEndIndex + 1, beforeSemiIndex)
            rawStylusValue = this.sourceCode.getText(
                firstValueNode,
                beforeSemiIndex
            )
        }

        const declSource = {
            start: this.sourceCode.getLoc(startIndex),
            input: this.input,
            end: this.sourceCode.getLoc(endIndex),
        }

        const { rawBefore } = this.getRawBefore(parent, declSource.start)
        const declRaws = {
            before: rawBefore,
            // after: "",
            between: rawBetween,
        }
        if (rawImportant) {
            declRaws.important = rawImportant
        }
        const rawValue = raw(value, rawStylusValue, rawCssValue)
        if (rawValue.raw) {
            declRaws.value = rawValue
        }

        // Create Declaration node
        const decl = postcss.decl()
        decl.parent = parent
        decl.raws = declRaws
        decl.source = declSource
        decl.prop = prop
        if (importantNode) {
            decl.important = true
        }
        decl.value = value
        // Stylus property
        if (!hasColon) {
            decl.raws.betweenStylus = rawBetweenStylus
        }
        if (!hasSemi) {
            decl.omittedSemi = true
        }
        parent.nodes.push(decl)
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

    ruleset_(node, parent) {
        // Loop to find the deepest ruleset node
        this.raws.multiRuleProp = ""

        for (const contentNode of node.content) {
            switch (contentNode.type) {
                case "block": {
                    // Create Rule node
                    const rule = postcss.rule()
                    rule.selector = ""
                    // Object to store raws for Rule
                    const ruleRaws = {
                        before: this.raws.before || DEFAULT_RAWS_RULE.before,
                        between: DEFAULT_RAWS_RULE.between,
                    }

                    // Variable to store spaces and symbols before declaration property
                    this.raws.before = ""
                    this.raws.comment = false

                    // Look up throw all nodes in current ruleset node
                    node.content
                        .filter(content => content.type === "block")
                        .forEach(innerContentNode =>
                            this.process(innerContentNode, rule)
                        )

                    if (rule.nodes.length) {
                        // Write selector to Rule
                        rule.selector = this.sourceCode
                            .getText(node.start, contentNode.start)
                            .slice(0, -1)
                            .replace(/\s+$/, spaces => {
                                ruleRaws.between = spaces
                                return ""
                            })
                        // Set parameters for Rule node
                        rule.parent = parent
                        rule.source = {
                            start: node.start,
                            end: node.end,
                            input: this.input,
                        }
                        rule.raws = ruleRaws
                        parent.nodes.push(rule)
                    }
                    break
                }
                default:
            }
        }
    }

    block_(node, parent) {
        // If nested rules exist, wrap current rule in new rule node
        if (this.raws.multiRule) {
            if (this.raws.multiRulePropVariable) {
                this.raws.multiRuleProp = `$${this.raws.multiRuleProp}`
            }
            const multiRule = Object.assign(postcss.rule(), {
                source: {
                    start: {
                        line: node.start.line - 1,
                        column: node.start.column,
                    },
                    end: node.end,
                    input: this.input,
                },
                raws: {
                    before: this.raws.before || DEFAULT_RAWS_RULE.before,
                    between: DEFAULT_RAWS_RULE.between,
                },
                parent,
                selector:
                    (this.raws.customProperty ? "--" : "") +
                    this.raws.multiRuleProp,
            })
            parent.push(multiRule)
            parent = multiRule
        }

        this.raws.before = ""

        // Looking for declaration node in block node
        for (const contentNode of node.content) {
            this.process(contentNode, parent)
        }
        if (this.raws.multiRule) {
            this.raws.beforeMulti = this.raws.before
        }
    }

    declaration_(node, parent) {
        let isBlockInside = false
        // Create Declaration node
        const declarationNode = postcss.decl()
        declarationNode.prop = ""

        // Object to store raws for Declaration
        const declarationRaws = Object.assign(declarationNode.raws, {
            before: this.raws.before || DEFAULT_RAWS_DECL.before,
            between: DEFAULT_RAWS_DECL.between,
            semicolon: DEFAULT_RAWS_DECL.semicolon,
        })

        this.raws.property = false
        this.raws.betweenBefore = false
        this.raws.comment = false
        // Looking for property and value node in declaration node
        for (const contentNode of node.content) {
            switch (contentNode.type) {
                case "customProperty":
                    this.raws.customProperty = true
                // fall through
                case "property": {
                    /* this.raws.property to detect is property is already defined in current object */
                    this.raws.property = true
                    this.raws.multiRuleProp = contentNode.content[0].content
                    this.raws.multiRulePropVariable =
                        contentNode.content[0].type === "variable"
                    this.process(contentNode, declarationNode)
                    break
                }
                case "propertyDelimiter": {
                    if (this.raws.property && !this.raws.betweenBefore) {
                        /* If property is already defined and there's no ':' before it */
                        declarationRaws.between += contentNode.content
                        this.raws.multiRuleProp += contentNode.content
                    } else {
                        /* If ':' goes before property declaration, like :width 100px */
                        this.raws.betweenBefore = true
                        declarationRaws.before += contentNode.content
                        this.raws.multiRuleProp += contentNode.content
                    }
                    break
                }
                case "space": {
                    declarationRaws.between += contentNode.content
                    break
                }
                case "value": {
                    // Look up for a value for current property
                    switch (contentNode.content[0].type) {
                        case "block": {
                            isBlockInside = true
                            // If nested rules exist
                            if (Array.isArray(contentNode.content[0].content)) {
                                this.raws.multiRule = true
                            }
                            this.process(contentNode.content[0], parent)
                            break
                        }
                        case "variable": {
                            declarationNode.value = "$"
                            this.process(contentNode, declarationNode)
                            break
                        }
                        case "color": {
                            declarationNode.value = "#"
                            this.process(contentNode, declarationNode)
                            break
                        }
                        case "number": {
                            if (contentNode.content.length > 1) {
                                declarationNode.value = contentNode.content.join(
                                    ""
                                )
                            } else {
                                this.process(contentNode, declarationNode)
                            }
                            break
                        }
                        case "parentheses": {
                            declarationNode.value = "("
                            this.process(contentNode, declarationNode)
                            break
                        }
                        default: {
                            this.process(contentNode, declarationNode)
                        }
                    }
                    break
                }
                default:
            }
        }

        if (!isBlockInside) {
            // Set parameters for Declaration node
            declarationNode.source = {
                start: node.start,
                end: node.end,
                input: this.input,
            }
            declarationNode.parent = parent
            parent.nodes.push(declarationNode)
        }

        this.raws.before = ""
        this.raws.customProperty = false
        this.raws.multiRuleProp = ""
        this.raws.property = false
    }

    customProperty_(node, parent) {
        this.property(node, parent)
        parent.prop = `--${parent.prop}`
    }

    property_(node, parent) {
        // Set property for Declaration node
        switch (node.content[0].type) {
            case "variable": {
                parent.prop += "$"
                break
            }
            case "interpolation": {
                this.raws.interpolation = true
                parent.prop += "#{"
                break
            }
            default:
        }
        parent.prop += node.content[0].content
        if (this.raws.interpolation) {
            parent.prop += "}"
            this.raws.interpolation = false
        }
    }

    value_(node, parent) {
        if (!parent.value) {
            parent.value = ""
        }
        // Set value for Declaration node
        if (node.content.length) {
            for (const contentNode of node.content) {
                switch (contentNode.type) {
                    case "important": {
                        parent.raws.important = contentNode.content
                        parent.important = true
                        const match = parent.value.match(/^(.*?)(\s*)$/)
                        if (match) {
                            parent.raws.important =
                                match[2] + parent.raws.important
                            parent.value = match[1]
                        }
                        break
                    }
                    case "parentheses": {
                        parent.value += `${contentNode.content.join("")})`
                        break
                    }
                    case "percentage": {
                        parent.value += `${contentNode.content.join("")}%`
                        break
                    }
                    default: {
                        if (contentNode.content.constructor === Array) {
                            parent.value += contentNode.content.join("")
                        } else {
                            parent.value += contentNode.content
                        }
                    }
                }
            }
        }
    }

    singlelineComment_(node, parent) {
        return this.comment(node, parent, true)
    }

    multilineComment_(node, parent) {
        return this.comment(node, parent, false)
    }

    comment_(node, parent, inline) {
        // https://github.com/nodesecurity/eslint-plugin-security#detect-unsafe-regex
        // eslint-disable-next-line security/detect-unsafe-regex
        const text = node.content.match(/^(\s*)((?:\S[\s\S]*?)?)(\s*)$/)

        this.raws.comment = true

        const comment = Object.assign(postcss.comment(), {
            text: text[2],
            raws: {
                before: this.raws.before || DEFAULT_COMMENT_DECL.before,
                left: text[1],
                right: text[3],
                inline,
            },
            source: {
                start: {
                    line: node.start.line,
                    column: node.start.column,
                },
                end: node.end,
                input: this.input,
            },
            parent,
        })

        if (this.raws.beforeMulti) {
            comment.raws.before += this.raws.beforeMulti
            this.raws.beforeMulti = undefined
        }

        parent.nodes.push(comment)
        this.raws.before = ""
    }

    space_(node, parent) {
        // Spaces before root and rule
        switch (parent.type) {
            case "root": {
                this.raws.before += node.content
                break
            }
            case "rule": {
                if (this.raws.comment) {
                    this.raws.before += node.content
                } else if (this.raws.loop) {
                    parent.selector += node.content
                } else {
                    this.raws.before = (this.raws.before || "\n") + node.content
                }
                break
            }
            default:
        }
    }

    declarationDelimiter_(node) {
        this.raws.before += node.content
    }

    loop_(node, parent) {
        const loop = postcss.rule()
        this.raws.comment = false
        this.raws.multiRule = false
        this.raws.loop = true
        loop.selector = ""
        loop.raws = {
            before: this.raws.before || DEFAULT_RAWS_RULE.before,
            between: DEFAULT_RAWS_RULE.between,
        }
        if (this.raws.beforeMulti) {
            loop.raws.before += this.raws.beforeMulti
            this.raws.beforeMulti = undefined
        }
        node.content.forEach((contentNode, i) => {
            if (node.content[i + 1] && node.content[i + 1].type === "block") {
                this.raws.loop = false
            }
            this.process(contentNode, loop)
        })
        parent.nodes.push(loop)
        this.raws.loop = false
    }

    atkeyword_(node, parent) {
        parent.selector += `@${node.content}`
    }

    operator_(node, parent) {
        parent.selector += node.content
    }

    variable_(node, parent) {
        if (this.raws.loop) {
            parent.selector += `$${node.content[0].content}`
        } else {
            parent.selector += `#${node.content[0].content}`
        }
    }

    ident_(node, parent) {
        parent.selector += node.content
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
