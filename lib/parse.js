"use strict"

const Input = require("postcss/lib/input")

const Parser = require("./parser")

module.exports = (stylus, opts) => {
    const input = new Input(stylus, opts)

    const parser = new Parser(input)
    parser.parse()

    return parser.root
}
