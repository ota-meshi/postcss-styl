<template>
    <div class="ast-explorer-root">
        <div class="ast-tools">
            <span class="ast-tools__time">{{ time }}</span
            ><AstOptions v-model="options" />
        </div>
        <div class="ast-explorer">
            <MonacoEditor
                ref="sourceEditor"
                v-model="stylusValue"
                language="stylus"
                @focus-editor-text="handleFocus('source')"
                @change-cursor-position="handleCursor($event, 'source')"
            />
            <MonacoEditor
                ref="jsonEditor"
                :model-value="astJson.json"
                language="json"
                read-only
                @focus-editor-text="handleFocus('json')"
                @change-cursor-position="handleCursor($event, 'json')"
            />
        </div>
    </div>
</template>

<script>
import MonacoEditor from "./MonacoEditor.vue"
import AstOptions from "./AstOptions.vue"
import * as stylusParser from "../../.."

export default {
    name: "AstExplorer",
    components: { MonacoEditor, AstOptions },
    data() {
        return {
            options: {
                showLocations: false,
                ecmaVersion: "",
                jsonSyntax: "",
            },
            stylusValue: `// Try Stylus!
body {
  font: 14px/1.5 Helvetica, arial, sans-serif;
  #logo {
    border-radius: 5px;
  }
}

// Flexible syntax
body
  font 14px/1.5 Helvetica, arial, sans-serif
  button
  button.button
  input[type='button']
  input[type='submit']
    border-radius 5px

// Mixins
border-radius(val)
  -webkit-border-radius: val
  -moz-border-radius: val
  border-radius: val
  
button {
  border-radius(5px);
}
`,
            astJson: {},
            modeEditor: "",
            time: "",
        }
    },
    watch: {
        options: {
            handler: "refresh",
            deep: true,
        },
        stylusValue: {
            handler: "refresh",
            immediate: true,
        },
    },
    methods: {
        refresh() {
            const options = {}
            // eslint-disable-next-line no-console -- demo
            console.log("parse!")
            const start = Date.now()
            let ast
            try {
                ast = stylusParser.parse(this.stylusValue, options)
            } catch (e) {
                ast = {
                    message: e.message,
                    ...e,
                }
            }
            const time = Date.now() - start
            this.time = `${time}ms`
            const json = createAstJson(this.options, ast)
            this.astJson = json
        },
        handleFocus(editor) {
            this.modeEditor = editor
        },
        handleCursor(evt, editor) {
            if (this.modeEditor !== editor || !this.astJson) {
                return
            }

            const position = evt.position
            if (editor === "source") {
                const locData = findLoc(this.astJson, "sourceLoc")
                if (locData) {
                    this.$refs.jsonEditor.setCursorPosition(locData.jsonLoc)
                }
            } else if (editor === "json") {
                const locData = findLoc(this.astJson, "jsonLoc")
                if (locData) {
                    this.$refs.sourceEditor.setCursorPosition(
                        {
                            start: locData.sourceLoc.start,
                            end:
                                locData.sourceLoc.end ||
                                locData.sourceLoc.start,
                        },
                        { endColumnOffset: 1 },
                    )
                }
            }

            // eslint-disable-next-line require-jsdoc -- demo
            function findLoc(astJson, locName) {
                let locData = astJson.locations.find((l) =>
                    locInPoint(l[locName], position),
                )
                let nextLocData
                while (
                    locData &&
                    (nextLocData = locData.locations.find((l) =>
                        locInPoint(l[locName], position),
                    ))
                ) {
                    locData = nextLocData
                }
                return locData
            }

            // eslint-disable-next-line require-jsdoc -- demo
            function locInPoint(loc, pos) {
                const end = loc.end || { line: Infinity, column: Infinity }
                if (
                    loc.start.line < pos.lineNumber &&
                    pos.lineNumber < end.line
                ) {
                    return true
                }
                if (
                    loc.start.line === pos.lineNumber &&
                    pos.lineNumber === end.line
                ) {
                    return (
                        loc.start.column <= pos.column &&
                        pos.column < end.column
                    )
                }
                if (
                    loc.start.line === pos.lineNumber &&
                    pos.lineNumber < end.line
                ) {
                    return loc.start.column <= pos.column
                }
                if (
                    loc.start.line < pos.lineNumber &&
                    pos.lineNumber === end.line
                ) {
                    return pos.column < end.column
                }
                return false
            }
        },
    },
}

class AstJsonContext {
    constructor() {
        this.json = ""
        this.jsonPosition = { line: 1, column: 1 }
        this.locations = []
        this._indentOffset = 0
        this._stack = null
    }

    pushNode(node) {
        this._stack = {
            upper: this._stack,
            node,
            jsonLocStart: { ...this.jsonPosition },
            locations: [],
        }
    }

    popNode() {
        const loc = {
            node: this._stack.node,
            sourceLoc: this._stack.node.source,
            jsonLoc: {
                start: this._stack.jsonLocStart,
                end: { ...this.jsonPosition },
            },
            locations: this._stack.locations,
        }

        this._stack = this._stack.upper
        if (this._stack) {
            this._stack.locations.push(loc)
        } else {
            this.locations.push(loc)
        }
    }

    appendText(text) {
        const str = String(text)
        this.json += str
        const lines = str.split("\n")
        if (lines.length > 1) {
            this.jsonPosition = {
                line: this.jsonPosition.line + lines.length - 1,
                column: lines.pop().length + 1,
            }
        } else {
            this.jsonPosition.column += str.length
        }
        return this
    }

    appendIndent() {
        return this.appendText("  ".repeat(this._indentOffset))
    }

    indent() {
        this._indentOffset++
        return this
    }

    outdent() {
        this._indentOffset--
        return this
    }
}

/**
 * Build AST JSON
 */
function createAstJson(options, value) {
    const ctx = new AstJsonContext()
    processValue(options, ctx, value)
    return ctx
}

// eslint-disable-next-line require-jsdoc -- ignore
function processValue(options, ctx, value) {
    const type = typeof value
    if (
        type === "string" ||
        type === "number" ||
        type === "boolean" ||
        value === null
    ) {
        ctx.appendText(JSON.stringify(value))
        return
    } else if (type !== "object") {
        ctx.appendText('"?"')
        return
    }
    if (Array.isArray(value)) {
        ctx.appendText("[\n").indent()
        const arr = [...value]
        while (arr.length) {
            ctx.appendIndent()
            const e = arr.shift()
            processValue(options, ctx, e)
            if (arr.length) {
                ctx.appendText(",")
            }
            ctx.appendText("\n")
        }
        ctx.outdent().appendIndent().appendText("]")
    } else {
        let entries = Object.entries(value)
        const valueIsNode = isNode(value)
        if (valueIsNode) {
            ctx.pushNode(value)
            const typeEntry = entries.find(([key]) => key === "type")
            const locEntries = options.showLocations
                ? entries.filter(([key]) => key === "source")
                : []
            entries = entries.filter(
                ([key]) => key !== "source" && key !== "parent",
            )
            if (typeEntry) entries.unshift(typeEntry)
            entries.push(...locEntries)

            const sourceEntry = entries.find(([key]) => key === "source")
            if (sourceEntry && sourceEntry[1]) {
                delete sourceEntry[1].input
            }
        }
        ctx.appendText("{\n").indent()
        while (entries.length) {
            ctx.appendIndent()
            const [key, val] = entries.shift()
            processValue(options, ctx, key)
            ctx.appendText(": ")
            processValue(options, ctx, val)
            if (entries.length) {
                ctx.appendText(",")
            }
            ctx.appendText("\n")
        }
        ctx.outdent().appendIndent().appendText("}")

        if (valueIsNode) {
            ctx.popNode()
        }
    }
}

/**
 * Check if given value is node
 */
function isNode(value) {
    return value != null && "source" in value && "type" in value
}
</script>

<style scoped lang="stylus">
.ast-explorer-root {
  min-width: 1px;
  min-height: 1px;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.ast-tools {
  display: flex;
  text-align: right;
}

.ast-tools__time {
  margin-right: auto;
}

.ast-explorer {
  min-width: 1px;
  display: flex;
  height: 100%;
}
</style>
