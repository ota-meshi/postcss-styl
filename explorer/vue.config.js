const webpack = require("webpack")
module.exports = {
    publicPath: "/postcss-styl/",

    configureWebpack(_config, _isServer) {
        return {
            resolve: {
                alias: {
                    stylus: require.resolve(
                        "../node_modules/stylus/lib/stylus",
                    ),
                    module: require.resolve("./shim/module"),
                },
            },
            plugins: [
                new webpack.DefinePlugin({
                    "process.version": JSON.stringify(process.version),
                    // process: JSON.stringify(process),
                }),
            ],
        }
    },
}
