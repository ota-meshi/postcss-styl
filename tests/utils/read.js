"use strict"

const fs = require("fs")

module.exports = file => fs.readFileSync(file).toString()
