import stylus from "./stylus"

/**
 * Setup Monarch for stylus
 * @param {object} monaco monaco object
 * @returns {void}
 */
export function stylusLanguageSetup(monaco) {
    monaco.languages.register({ id: "stylus" })
    monaco.languages.setMonarchTokensProvider("stylus", stylus)
}
