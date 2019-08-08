"use strict"

module.exports = {
    globals: {
        after: false,
        afterEach: false,
        before: false,
        beforeEach: false,
        describe: false,
        it: false,
        mocha: false,
        xdescribe: false,
        xit: false,
    },
    rules: {
        "max-nested-callbacks": "off",
    },
}