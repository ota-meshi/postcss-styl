"use strict"

module.exports = {
    root: true,
    parserOptions: {},
    extends: [
        "plugin:@mysticatea/+node",
    ],
    plugins: ["@mysticatea"],
    rules: {
        "@mysticatea/node/exports-style": "off",
        "@mysticatea/node/no-extraneous-require": "off",
        "@mysticatea/node/no-deprecated-api": "off"
    },
}