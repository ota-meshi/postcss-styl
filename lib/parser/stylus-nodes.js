"use strict"

const stylus = require("stylus")

const nodeTypes = new Map()
const nodeTypeSingletons = new Map()

for (const key of Object.keys(stylus.nodes)) {
    const value = stylus.nodes[key]
    if (value == null) {
        continue
    }
    const name = key.toLowerCase()
    if (name !== key) {
        nodeTypes.set(value, name)
    } else {
        nodeTypeSingletons.set(value, name)
    }
}

module.exports = {
    getName(node) {
        const name =
            nodeTypes.get(node.constructor) || nodeTypeSingletons.get(node)
        if (name) {
            return name
        }

        if ("nodeName" in node) {
            return node.nodeName
        }
        return undefined
    },
    patch4Min() {
        // check minify
        // eslint-disable-next-line func-style, no-empty-function -- ignore
        const Test = function Test() {}
        if (Test.name === "Test") {
            return
        }
        // is minify
        // If minify, `nodeName` will not work, so apply the patch.
        for (const [Node, name] of nodeTypes.entries()) {
            Object.defineProperty(Node.prototype, "nodeName", {
                get() {
                    return name
                },
            })
        }
        for (const [node, name] of nodeTypeSingletons.entries()) {
            Object.defineProperty(node, "nodeName", {
                get() {
                    return name
                },
            })
        }
    },
}
