<template>
    <div class="root"></div>
</template>

<script>
import { stylusLanguageSetup } from "./scripts/languages/index"
const monacoScript = Array.from(
    window.document.head.querySelectorAll("script"),
).find((script) => script.src && script.src.includes("monaco"))
window.require.config({
    paths: {
        vs: monacoScript.src.replace(/\/vs\/.*$/u, "/vs"),
    },
    "vs/nls": {
        availableLanguages: {
            "*": "ja",
        },
    },
})
const editorLoaded = new Promise((resolve) => {
    window.require(["vs/editor/editor.main"], (r) => {
        resolve(r)
    })
})
editorLoaded.then(stylusLanguageSetup)
export default {
    name: "MonacoEditor",
    props: {
        modelValue: {
            type: String,
            default: "",
        },
        language: {
            type: String,
            default: "json",
        },
        readOnly: Boolean,
    },
    emits: ["update:modelValue", "changeCursorPosition", "focusEditorText"],
    watch: {
        modelValue(newValue) {
            const vm = this
            if (vm.editor) {
                if (newValue !== vm.editor.getValue()) {
                    vm.editor.setValue(newValue)
                }
            }
        },
    },
    async mounted() {
        const monaco = await editorLoaded
        const vm = this
        const options = Object.assign(
            {
                value: vm.modelValue,
                readOnly: vm.readOnly,
                theme: "vs-dark",
                language: vm.language,
                automaticLayout: true,
                fontSize: 14,
                // tabSize: 2,
                minimap: {
                    enabled: false,
                },
                renderControlCharacters: true,
                renderIndentGuides: true,
                renderValidationDecorations: "on",
                renderWhitespace: "boundary",
                scrollBeyondLastLine: false,
            },
            vm.options,
        )

        vm.editor = monaco.editor.create(vm.$el, options)
        vm.editor.onDidChangeModelContent((evt) => {
            const value = vm.editor.getValue()
            if (vm.modelValue !== value) {
                vm.$emit("update:modelValue", value, evt)
            }
        })
        vm.editor.onDidChangeCursorPosition((evt) => {
            vm.$emit("changeCursorPosition", evt)
        })
        vm.editor.onDidFocusEditorText((evt) => {
            vm.$emit("focusEditorText", evt)
        })
        monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
            validate: false,
        })
    },
    methods: {
        setCursorPosition(
            loc,
            {
                columnOffset = 0,
                startColumnOffset = columnOffset,
                endColumnOffset = columnOffset,
            } = {},
        ) {
            const vm = this
            if (vm.editor) {
                vm.editor.setSelection({
                    startLineNumber: loc.start.line,
                    startColumn: loc.start.column + startColumnOffset,
                    endLineNumber: loc.end.line,
                    endColumn: loc.end.column + endColumnOffset,
                })
            }
        },
    },
}
</script>
<style scoped lang="stylus">
.root {
  width: 100%;
  height: 100%;
}
</style>
