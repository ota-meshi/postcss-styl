"use strict"

module.exports = {
    extends: "stylelint-config-standard",
    rules: {
        "function-calc-no-invalid": true,

        // useless for the stylus
        "block-opening-brace-space-before": null,
        "block-closing-brace-newline-before": null,
        "declaration-block-trailing-semicolon": null,
        "selector-list-comma-newline-after": null,
        "selector-list-comma-space-before": null,
        "block-closing-brace-space-before": null,
        "property-no-unknown": null,
        "at-rule-no-unknown": null,

        // breaks stylus
        "at-rule-name-space-after": null,
    },
}
