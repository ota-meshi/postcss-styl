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

    decl(node, semicolon) {
        if (node.omittedSemi) {
            super.decl(node, false)
            return
        }
        super.decl(node, semicolon)
    }

    // comment(node) {
    //     const left = this.raw(node, "left", "commentLeft")
    //     const right = this.raw(node, "right", "commentRight")

    //     if (node.raws.inline) {
    //         this.builder(`//${left}${node.text}${right}`, node)
    //     } else {
    //         this.builder(`/*${left}${node.text}${right}*/`, node)
    //     }
    // }
}
