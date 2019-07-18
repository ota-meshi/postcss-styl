"use strict"

const fs = require("fs")
const path = require("path")

const utils = {
    isExistFile(file) {
        try {
            fs.statSync(file)
            return true
        } catch (err) {
            if (err.code === "ENOENT") {
                return false
            }
            throw err
        }
    },
    listupFixtures(root, opts = {}) {
        const fixtures = fs.readdirSync(root)

        if (opts.validOnly) {
            return fixtures.filter(
                name =>
                    !utils.isExistFile(path.join(root, `${name}/error.json`))
            )
        }
        return fixtures
    },
    read(file) {
        return fs.readFileSync(file).toString()
    },
    writeFixture(file, actual) {
        // eslint-disable-next-line no-process-env
        if (process.env.UPDATE_FIXTURES) {
            fs.writeFileSync(file, actual)
        }
    },
}
module.exports = utils
