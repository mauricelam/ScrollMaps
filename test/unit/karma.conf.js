module.exports = function (config) {
    config.set({
        basePath: '../../',
        frameworks: ['jasmine', 'webpack'],

        files: [
            { pattern: 'test/unit/**/*.test.ts', watched: false }
        ],

        preprocessors: {
            'test/unit/**/*.test.ts': ['webpack']
        },

        webpack: {
            mode: 'development',
            module: {
                rules: [
                    {
                        test: /\.ts$/,
                        use: 'ts-loader',
                        exclude: /node_modules/
                    }
                ]
            },
            resolve: {
                extensions: ['.ts', '.js'],
                modules: ['../../', '../node_modules']
            },
            devtool: 'inline-source-map'
        },

        reporters: ['progress'],
        browsers: ['ChromeHeadless'],
        logLevel: config.LOG_INFO,
        singleRun: true,
    });
};