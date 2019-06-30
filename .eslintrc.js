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