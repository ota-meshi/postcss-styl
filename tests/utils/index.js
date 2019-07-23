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
    listupFixtures(root) {
        const fixtures = fs.readdirSync(root).map(name => {
            const filesHandler = {
                get(_target, fileName) {
                    return path.join(root, `${name}/${fileName}`)
                },
            }
            const files = new Proxy({}, filesHandler)

            const contentsHandler = {
                get(_target, fileName) {
                    return utils.read(files[fileName])
                },
            }
            const contents = new Proxy({}, contentsHandler)
            return {
                name,
                files,
                contents,
                findFileName(...fileNames) {
                    for (const fileName of fileNames) {
                        if (utils.isExistFile(files[fileName])) {
                            return fileName
                        }
                    }
                    return null
                },
            }
        })

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
    deleteFixture(file) {
        // eslint-disable-next-line no-process-env
        if (process.env.UPDATE_FIXTURES) {
            fs.unlinkSync(file)
        }
    },
}
module.exports = utils
