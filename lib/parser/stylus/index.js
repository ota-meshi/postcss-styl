"use strict"

const semver = require("semver")
const pkg = require("stylus/package.json")
if (semver.satisfies(pkg.version, ">0.54.5")) {
    module.exports = require("stylus")
    return
}

// import from https://github.com/stylus/stylus/tree/ab512218c48b67e8b9f0b63ff073779bcce63208
module.exports = require("./patched-stylus")
