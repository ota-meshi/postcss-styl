"use strict"

const syntax = require("postcss-syntax")
const postcssStyl = require("postcss-styl-parser")

module.exports = syntax({
    stylus: postcssStyl,
})
