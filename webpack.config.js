const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

module.exports = {
    entry: './src/script.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'public'), // updated this line
    },
    devServer: {
        static: {
            directory: path.join(__dirname, 'public'), // updated this line
        },
        compress: true,
        port: 9000,
        open: {
            app: {
                name: 'google-chrome', // Or 'chrome' on Windows
            },
        },
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/index.html'
        })
    ],
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.glsl$/,
                use: 'raw-loader'
            }
        ],
    },
};