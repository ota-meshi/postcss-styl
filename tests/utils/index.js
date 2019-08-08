"use strict"

const fs = require("fs")
const path = require("path")

/**
 * listup fixture dirs
 * @param {*} root
 */
function listupFixtureDirs(root) {
    const result = []
    for (const name of fs.readdirSync(root)) {
        const filepath = path.join(root, `${name}`)
        if (fs.statSync(filepath).isDirectory()) {
            if (fs.readdirSync(filepath).find(n => n.startsWith("input."))) {
                result.push(name)
            } else {
                result.push(
                    ...listupFixtureDirs(filepath).map(n => `${name}/${n}`)
                )
            }
        } else if (
            // eslint-disable-next-line no-process-env
            process.env.UPDATE_FIXTURES &&
            name.endsWith(".styl")
        ) {
            fs.renameSync(filepath, `${filepath}_wk`)
            fs.mkdirSync(filepath)
            fs.renameSync(`${filepath}_wk`, `${filepath}/input.styl`)
        }
    }
    return result
}

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
        const fixtures = listupFixtureDirs(root).map(name => {
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
    writeFixture(file, actual, error) {
        // eslint-disable-next-line no-process-env
        if (process.env.UPDATE_FIXTURES) {
            fs.writeFileSync(file, actual)
        } else if (error) {
            throw error
        }
    },
    deleteFixture(file) {
        // eslint-disable-next-line no-process-env
        if (process.env.UPDATE_FIXTURES && utils.isExistFile(file)) {
            fs.unlinkSync(file)
        }
    },
}
module.exports = utils
