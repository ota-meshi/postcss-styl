"use strict"

const Stringifier = require("postcss/lib/stringifier")

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
        return super.raw(node, own, detect)
    }

    block(node, start) {
        if (!node.pythonic) {
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

    atrule(node, semicolon) {
        if (node.raws.identifier == null) {
            super.atrule(node, !node.omittedSemi && semicolon)
        } else {
            let name = node.raws.identifier + node.name
            const params = node.params ? this.rawValue(node, "params") : ""

            if (typeof node.raws.afterName !== "undefined") {
                name += node.raws.afterName
            } else if (params) {
                name += " "
            }

            if (node.nodes) {
                this.block(node, name + params)
            } else {
                const end =
                    (node.raws.between || "") +
                    (!node.omittedSemi && semicolon ? ";" : "")
                this.builder(name + params + end, node)
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
