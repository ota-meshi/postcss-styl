"use strict"

const stylus = require("stylus")

const nodeTypes = new Map()

for (const name of Object.keys(stylus.nodes)) {
    nodeTypes.set(stylus.nodes[name], name.toLowerCase())
}

module.exports = {
    getName(node) {
        const name = nodeTypes.get(node.constructor)
        if (name) {
            return name
        }

        if ("nodeName" in node) {
            return node.nodeName
        }
        return undefined
    },
}
