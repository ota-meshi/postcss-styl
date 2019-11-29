"use strict"

require("./parser/stylus-nodes").patch4Min()

const parse = require("./parse")
const stringify = require("./stringify")
module.exports = {
    parse,
    stringify,
}
