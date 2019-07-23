"use strict"

module.exports = {
    parserOptions: {},
    extends: [
        "plugin:@mysticatea/es2015",
        "plugin:@mysticatea/+node",
    ],
    plugins: [],
    rules: {
        'require-jsdoc': 'error',
        "no-warning-comments": "warn",
        "@mysticatea/no-use-ignored-vars": ["error", "^_[a-zA-Z]+$"],
    },

    overrides: [
        {
            files: ["scripts/*.js"],
            rules: {
                "require-jsdoc": "off",
            },
        },
    ],
}