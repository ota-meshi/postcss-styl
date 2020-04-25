"use strict"

const Stringifier = require("postcss/lib/stringifier")

const DEFAULT_INDENT = "    "

/**
 * Checks if `@css` for a given node.
 * @param {*} node
 */
function isCssLiteral(node) {
    return node.type === "atrule" && node.name === "css" && node.cssLiteral
}

/**
 * Checks if pythonic for a given node.
 * @param {*} node
 */
function isPythonic(node) {
    if (!node || !node.pythonic) {
        return false
    }
    if (
        !node.nodes ||
        !node.nodes.some(n => n.type !== "comment" || !n.raws.inline)
    ) {
        // empty
        return false
    }
    // Check expression @block
    if (node.type === "atrule" && node.atblock) {
        const nameAndParams = node.name + node.params
        if (nameAndParams.toLowerCase() === "@block" || !nameAndParams.trim()) {
            // Expression @block (No assignment @block)
            return false
        }
    }
    // Check object expression
    if (node.type === "atrule" && node.object) {
        return false
    }
    return true
}

/**
 * Checks if object property for a given node.
 * @param {*} node
 */
function isObjectProperty(node) {
    if (!node.parent) {
        return false
    }
    if (node.objectProperty || node.parent.object) {
        return true
    }
    return false
}

/**
 * Checks if omittedSemi for a given node.
 * @param {*} node
 */
function isOmittedSemi(node) {
    if (!node.omittedSemi) {
        return false
    }
    if (isObjectProperty(node)) {
        const parent = node.parent
        const index = parent.nodes.indexOf(node)
        const nextNodes = parent.nodes.slice(index + 1)
        if (
            nextNodes.length &&
            nextNodes.every(
                next => next.raws.before && !next.raws.before.includes("\n") // no line feed
            )
        ) {
            return false
        }
    }
    return true
}

/**
 * The source code split into lines according
 * @param {string} text source code
 * @returns {string[]} lines
 */
function toLines(text) {
    const lines = []

    const lineEndingPattern = /\r\n|\r|\n/gu
    let match = null

    let start = 0
    while ((match = lineEndingPattern.exec(text))) {
        const end = match.index + match[0].length
        lines.push(text.slice(start, end))
        start = end
    }
    lines.push(text.slice(start))

    return lines
}

/**
 * Checks if indent adjustment is required for a given node.
 * @param {*} node
 */
function isNeedAdjustIndent(node) {
    if (node.postfix || node.type === "comment") {
        return false
    }
    let { parent } = node
    if (parent && parent.postfix) {
        parent = parent.parent
    }
    if (!parent) {
        return false
    }
    if (isPythonic(parent)) {
        return true
    } else if (parent.type === "root") {
        const index = parent.nodes.indexOf(node)
        if (index <= 0) {
            return false
        }
        const prevNodes = parent.nodes.slice(0, index).reverse()
        const prev = prevNodes.find(p => p.type !== "comment")
        return isPythonic(prev)
    }
    return false
}

/**
 * Adjust the pythonic indent.
 * @param {string} indent
 * @param {string} targetBefore
 */
function adjustIndent(indent, targetBefore) {
    const targetBeforeLines = toLines(targetBefore)

    targetBeforeLines.pop()
    if (!targetBeforeLines.length) {
        targetBeforeLines.push("\n")
    }
    targetBeforeLines.push(indent)

    return targetBeforeLines.join("")
}

/**
 * Remove commnets on selector
 * @param {string} selector
 * @returns {string} removed comments
 */
function removeLastCommentsSelector(selector) {
    return selector.replace(/\/\/.*$/u, "").replace(/\/\*.*\*\/\s*$/u, "")
}

/**
 * Adjust selectors indent
 * @param {node} node
 * @param {string} selectors
 * @param {string} indent
 * @returns {string} indented selectors
 */
function adjustSelectorsIndent(node, selectors, indent) {
    const lines = toLines(selectors)

    return lines
        .map((line, index) => {
            const trimed = line.trim()
            if (!trimed) {
                // ignore blank line
                return line
            }

            if (!node.pythonic) {
                // If it is not pythonic, adjust the indentation other than comma delimiter.
                if (/^,/u.test(trimed)) {
                    return line
                }
                const lastLine = lines[index - 1]
                if (
                    lastLine &&
                    /,$/u.test(removeLastCommentsSelector(lastLine).trim())
                ) {
                    return line
                }
            }

            return index === 0
                ? line.replace(/^\s*/u, "")
                : line.replace(/^\s*/u, indent)
        })
        .join("")
}

module.exports = class StylusStringifier extends Stringifier {
    rawValue(node, prop) {
        const value = this.rawValuePlain(node, prop)
        if (prop === "selector" && /\r\n|\r|\n/gu.test(value)) {
            const indent = this.getIndent(node)

            return adjustSelectorsIndent(node, value, indent)
        }
        return value
    }

    raw(node, own, detect) {
        const raw = this.rawPlain(node, own, detect)
        if (own === "before") {
            // adjust indent
            if (isNeedAdjustIndent(node)) {
                return adjustIndent(this.getIndent(node), raw)
            }
        }

        return raw
    }

    block(node, start) {
        if (!isPythonic(node) && !node.postfix) {
            super.block(node, start)
            return
        }
        const between = !node.postfix
            ? this.raw(node, "between", "beforeOpen")
            : ""
        this.builder(start + between, node, "start")
        let after = null

        if (node.nodes && node.nodes.length) {
            this.body(node)
            after = this.raw(node, "after")
        } else {
            after = this.raw(node, "after", "emptyBody")
        }
        if (
            node.postfix &&
            node.raws.after == null &&
            node.raws.stylusAfter == null
        ) {
            after = ""
        }

        if (after) {
            this.builder(after)
        }
        this.builder("", node, "end")
    }

    root(node) {
        this.body(node)

        const rawAfter = node.raws.stylusAfter || node.raws.after
        if (rawAfter) {
            this.builder(rawAfter)
        }
    }

    // eslint-disable-next-line complexity
    atrule(node, semicolon) {
        if (isCssLiteral(node)) {
            new Stringifier(this.builder).atrule(node, semicolon)
            return
        }
        const needSemi = !isOmittedSemi(node) && semicolon
        const semiChar = needSemi && isObjectProperty(node) ? "," : ";"
        if (
            node.raws.identifier == null &&
            !node.function &&
            !node.postfix &&
            !node.atblock &&
            semiChar === ";"
        ) {
            super.atrule(node, needSemi)
        } else {
            if (node.postfix && node.nodes) {
                this.block(node, "")
                if (node.raws && node.raws.postfixBefore != null) {
                    this.builder(node.raws.postfixBefore)
                } else {
                    this.builder(" ") // default
                }
            }
            let name = node.raws.identifier + node.name
            const params = node.params ? this.rawValue(node, "params") : ""

            if (typeof node.raws.afterName !== "undefined") {
                name += node.raws.afterName
            } else if (node.function || node.call || node.expression) {
                // name += ""
            } else if (params && name) {
                name += " "
            }

            let nameAndParams = name + params
            if (node.atblock) {
                // adjust @block
                if (isPythonic(node)) {
                    nameAndParams = nameAndParams.replace(/@block$/iu, "")
                } else if (!/@block/iu.test(nameAndParams)) {
                    nameAndParams += "@block"
                }
            }

            if (!node.postfix && node.nodes) {
                this.block(node, nameAndParams)
            } else {
                const end =
                    (node.raws.stylusBetween || node.raws.between || "") +
                    (needSemi ? semiChar : "")
                this.builder(nameAndParams + end, node)
            }
        }
        if (node.raws.ownSemicolon) {
            this.builder(node.raws.ownSemicolon, node, "end")
        }
    }

    decl(node, semicolon) {
        const needSemi = !isOmittedSemi(node) && semicolon
        const semiChar = needSemi && isObjectProperty(node) ? "," : ";"
        if (needSemi && semiChar === ";") {
            super.decl(node, needSemi)
            return
        }
        super.decl(node, false)
        if (needSemi) {
            this.builder(semiChar, node)
        }
    }

    comment(node) {
        if (!node.raws.inline) {
            super.comment(node)
            return
        }
        const left = this.raw(node, "left", "commentLeft")
        const right = this.raw(node, "right", "commentRight")

        const text = node.raws.text || node.text
        this.builder(`//${left}${text}${right}`, node)
    }

    rawValuePlain(node, prop) {
        const value = node[prop]
        const raw = node.raws[prop]

        if (raw && raw.value === value && raw.stylus != null) {
            return raw.stylus
        }
        return super.rawValue(node, prop)
    }

    rawPlain(node, own, detect) {
        if (node.postfix && own === "before") {
            return ""
        }
        stylus: if (own) {
            if (
                own === "between" &&
                node.type === "decl" &&
                isObjectProperty(node)
            ) {
                break stylus
            }

            const stylusProp = `stylus${own[0].toUpperCase()}${own.slice(1)}`
            if (node.raws[stylusProp] != null) {
                return node.raws[stylusProp]
            }
        }
        return super.raw(node, own, detect)
    }

    /* eslint-disable complexity */
    /**
     * Get indent text
     * @param {*} node
     */
    getIndent(node) {
        /* eslint-enable complexity */
        if (!node.parent) {
            // root
            return ""
        }
        if (node.postfix) {
            return this.getIndent(node.nodes[0])
        }
        let childTarget = node
        let parentTarget = childTarget.parent
        while (parentTarget.postfix) {
            childTarget = parentTarget
            parentTarget = childTarget.parent
        }
        if (isNeedAdjustIndent(node)) {
            const firstSibling = parentTarget.nodes.find(
                n => n.type !== "comment"
            )
            if (firstSibling !== childTarget) {
                return this.getIndent(firstSibling)
            }
        }
        const spaces = this.rawPlain(node, "before")
        if (parentTarget.type === "root") {
            if (parentTarget.first === childTarget) {
                return /[^\r\n\S]*$/u.exec(spaces)[0]
            }
        }
        const r = /(?:\r\n|\r|\n)([^\r\n\S]*)$/u.exec(spaces)

        const parentIndent = this.getIndent(parentTarget)
        if (r) {
            // check
            if (
                parentTarget.type === "root" ||
                parentIndent.length < r[1].length
            ) {
                return r[1]
            }
        }
        let parent2Target = parentTarget.parent
        while (parent2Target && parent2Target.postfix) {
            parent2Target = parent2Target.parent
        }

        const parent2Indent =
            (parent2Target && this.getIndent(parent2Target)) || ""

        if (!parent2Indent) {
            return `${parentIndent}${parentIndent || DEFAULT_INDENT}`
        }
        if (parentIndent.startsWith(parent2Indent)) {
            return `${parentIndent}${parentIndent.slice(parent2Indent.length) ||
                DEFAULT_INDENT}`
        }
        return `${parentIndent}${" ".repeat(
            Math.max(parentIndent.length - parent2Indent.length, 0)
        ) || DEFAULT_INDENT}`
    }
}
