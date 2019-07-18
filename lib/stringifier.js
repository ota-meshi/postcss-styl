"use strict"

const Stringifier = require("postcss/lib/stringifier")

/**
 * Adjust the pythonic indent.
 * @param {string} firstSiblingBefore
 * @param {string} targetBefore
 */
function adjustIndent(firstSiblingBefore, targetBefore) {
    const indent = firstSiblingBefore.split(/^/gmu).pop()
    const targetBeforeLines = targetBefore.split(/^/gmu)
    const lastLine = targetBeforeLines.pop()
    if (/(?:\r\n|\r|\n)$/u.test(lastLine)) {
        targetBeforeLines.push(lastLine)
    }
    targetBeforeLines.push(indent)
    return targetBeforeLines.join("")
}

module.exports = class StylusStringifier extends Stringifier {
    rawValue(node, prop) {
        const value = node[prop]
        const raw = node.raws[prop]

        if (raw && raw.value === value && raw.stylus != null) {
            return raw.stylus
        }
        return super.rawValue(node, prop)
    }

    raw(node, own, detect) {
        if (own) {
            const stylusProp = `${own}Stylus`
            if (node.raws[stylusProp] != null) {
                return node.raws[stylusProp]
            }
        }

        const raw = super.raw(node, own, detect)

        // adjust indent
        if (
            own === "before" &&
            node.parent &&
            node.parent.pythonic &&
            !node.postfix
        ) {
            const firstSibling = node.parent.first
            if (firstSibling !== node) {
                return adjustIndent(this.raw(firstSibling, own, detect), raw)
            }
        }

        return raw
    }

    block(node, start) {
        if (!node.pythonic && !node.postfix) {
            super.block(node, start)
            return
        }
        const between = this.raw(node, "between", "beforeOpen")
        this.builder(start + between, node, "start")
        let after = null

        if (node.nodes && node.nodes.length) {
            this.body(node)
            after = this.raw(node, "after")
        } else {
            after = this.raw(node, "after", "emptyBody")
        }

        if (after) {
            this.builder(after)
        }
        this.builder("", node, "end")
    }

    root(node) {
        this.body(node)

        const rawAfter = node.raws.afterStylus || node.raws.after
        if (rawAfter) {
            this.builder(rawAfter)
        }
    }

    // eslint-disable-next-line complexity
    atrule(node, semicolon) {
        if (node.raws.identifier == null && !node.function && !node.postfix) {
            super.atrule(node, !node.omittedSemi && semicolon)
        } else {
            if (node.postfix && node.nodes) {
                this.block(node, "")
                if (node.raws && node.raws.postfixBefore) {
                    this.builder(node.raws.postfixBefore)
                }
            }
            let name = node.raws.identifier + node.name
            const params = node.params ? this.rawValue(node, "params") : ""

            if (typeof node.raws.afterName !== "undefined") {
                name += node.raws.afterName
            } else if (params) {
                name += " "
            }

            if (!node.postfix && node.nodes) {
                this.block(node, name + params)
            } else {
                const end =
                    (node.raws.betweenStylus || node.raws.between || "") +
                    (!node.omittedSemi && semicolon ? ";" : "")
                if (!node.function) {
                    this.builder(name + params + end, node)
                } else {
                    const body = this.rawValue(node, "body")
                    this.builder(name + params + body + end, node)
                }
            }
        }
        if (node.raws.ownSemicolon) {
            this.builder(node.raws.ownSemicolon, node, "end")
        }
    }

    decl(node, semicolon) {
        if (node.omittedSemi) {
            super.decl(node, false)
            return
        }
        super.decl(node, semicolon)
    }
}
