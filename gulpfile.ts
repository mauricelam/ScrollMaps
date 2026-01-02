import gulp from 'gulp';
const { src, dest, series, parallel } = gulp;
import webpack from 'webpack-stream';
import { deleteAsync } from 'del';
import rename from 'gulp-rename';
import zip from 'gulp-zip';
import mocha from 'gulp-mocha';
import { promises as fs } from 'fs';
import open from 'open';
import { makePromise, runParallel, runSeries, contentTransform, execTask } from './gulputils.ts';
import newer from 'gulp-newer';
import minimist from 'minimist';
import karma from 'karma';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

type Browser = 'chrome' | 'firefox' | 'edge'
const BROWSERS: Browser[] = ['chrome', 'firefox', 'edge']
const BROWSER_FLAGS = Object.fromEntries(BROWSERS.map((browser) => [`--${browser}`, `for [${browser}] browser`]));

class BuildContext {
    browser: Browser;
    version: number;

    constructor(browser: Browser, version: number) {
        if (!browser) throw new Error('Browser is not defined');
        if (!version) throw new Error('Version is not defined');
        this.browser = browser;
        this.version = version;

        // Bind all the functions of this instance
        for (const prop of Object.getOwnPropertyNames(BuildContext.prototype)) {
            if ((this as any)[prop] instanceof Function) {
                (this as any)[prop] = (this as any)[prop].bind(this);
                (this as any)[prop].displayName = `[${browser}] ${(this as any)[prop].name}`;
            }
        }
    }

    intermediatesDir() { return `gen/intermediates-${this.version}-${this.browser}` }
    pluginDir() { return `gen/plugin-${this.version}-${this.browser}`; }

    // ===== Tasks =====

    copySourceFiles() {
        return src([
            'src/**/*.css',
            'src/**/*.html',
        ])
            .pipe(newer(`${this.pluginDir()}/src`))
            .pipe(dest(`${this.pluginDir()}/src`));
    }

    copyImages() {
        return src(['images/**/*.png'], { encoding: false })
            .pipe(newer(`${this.pluginDir()}/images`))
            .pipe(dest(`${this.pluginDir()}/images`))
    }

    processManifest() {
        return src(this.browser === 'firefox' ? 'manifest_template.json' : 'manifest_chrome_template.json')
            .pipe(newer({ dest: `${this.pluginDir()}/manifest.json`, extra: __filename }))
            .pipe(contentTransform(this._processManifestTemplate))
            .pipe(rename('manifest.json'))
            .pipe(dest(this.pluginDir()));
    }

    async generateDomainDotJs() {
        const urls = this._getGoogleMapUrls();
        await fs.mkdir(this.intermediatesDir(), { recursive: true });
        await fs.writeFile(
            `${this.intermediatesDir()}/domains.override.ts`,
            'export default ' + JSON.stringify(urls));
    }

    _processManifestTemplate(content: string) {
        let manifest = JSON.parse(content);
        let processObj = (obj: any) => {
            if (Array.isArray(obj)) {
                let index = obj.indexOf('<%= all_google_maps_urls %>');
                if (index !== -1) {
                    obj.splice(index, 1, ...this._getGoogleMapUrls());
                }
            }
            if (typeof obj === 'object') {
                for (let o in obj) {
                    if (typeof obj[o] === 'object') {
                        processObj(obj[o]);
                    }
                }
                if (this.browser === 'chrome') {
                    if (obj && obj.browser_specific_settings && obj.browser_specific_settings.chrome) {
                        const chromeSettings = obj.browser_specific_settings.chrome;
                        if (chromeSettings) {
                            for (const i in chromeSettings) {
                                obj[i] = chromeSettings[i];
                            }
                            delete obj.browser_specific_settings;
                        }
                    }
                }
            }
        }
        processObj(manifest);
        manifest.version = '' + this.version;
        return JSON.stringify(manifest, null, '  ');
    }

    _getGoogleMapUrls() {
        const GOOGLE_MAPS_CCTLDS = [
            "at", "au", "be", "br", "ca", "cf", "cg", "ch", "ci", "cl", "cn", "uk", "in", "jp", "th",
            "cz", "dj", "de", "dk", "ee", "es", "fi", "fr", "ga", "gm", "hk", "hr", "hu", "ie", "is",
            "it", "li", "lt", "lu", "lv", "mg", "mk", "mu", "mw", "nl", "no", "nz", "pl", "pt", "ro",
            "ru", "rw", "sc", "se", "sg", "si", "sk", "sn", "st", "td", "tg", "tr", "tw", "ua", "us"];

        const GOOGLE_MAPS_URL_FORMATS = [
            "*://www.google.{tld}/maps*",
            "*://www.google.com.{tld}/maps*",
            "*://www.google.co.{tld}/maps*",
            "*://maps.google.{tld}/*",
            "*://maps.google.com.{tld}/*",
            "*://maps.google.co.{tld}/*"
        ];

        const GOOGLE_MAPS_SPECIAL_URLS = [
            "*://www.google.com/maps*",
            "*://maps.google.com/*",
            "*://mapy.google.pl/*",
            "*://ditu.google.cn/*"
        ];


        const output = [...GOOGLE_MAPS_SPECIAL_URLS];
        for (const tld of GOOGLE_MAPS_CCTLDS) {
            for (const format of GOOGLE_MAPS_URL_FORMATS) {
                output.push(format.replace('{tld}', tld));
            }
        }
        return output;
    }

    MINIFY_FILES() {
        return {
            'inject_everywhere': './src/inject_everywhere.ts',
            'inject_frame_permission': './src/inject_frame_permission.ts',
            'inject_scrollability': './src/Scrollability.ts',
            'inject_frame': './src/inject_frame.ts',
            'inject_main': './src/inject_main.ts',
            'background': './src/background.ts',
            'options': './src/options/options.ts',
            'popup': './src/popup/popup.ts',
        };
    }

    zipExtension() {
        return src([this.pluginDir() + '/**'], { encoding: false })
            .pipe(newer(`gen/scrollmaps-${this.version}-${this.browser}.zip`))
            .pipe(zip(`scrollmaps-${this.version}-${this.browser}.zip`))
            .pipe(dest('gen'));
    }

    async build() {
        const webpackTask = () => {
            const entries = this.MINIFY_FILES();
            return src(Object.values(entries))
                .pipe(webpack({
                    entry: entries,
                    output: {
                        filename: '[name].min.js',
                    },
                    resolve: {
                        extensions: ['.override.ts', '.ts', '.js'],
                        modules: [`${this.intermediatesDir()}`, 'src', 'node_modules'],
                    },
                    module: {
                        rules: [
                            {
                                test: /\.ts$/,
                                loader: 'ts-loader',
                                exclude: /node_modules/,
                            }
                        ]
                    },
                    mode: 'production',
                }))
                .pipe(dest(this.pluginDir()));

        };
        webpackTask.displayName = `[${this.browser}] webpack`;

        const buildUnpacked = parallel(
            webpackTask,
            this.copySourceFiles,
            this.copyImages,
            this.processManifest,
        );
        if (this.browser === 'firefox') {
            return runSeries(this.generateDomainDotJs, buildUnpacked, this.zipExtension);
        } else {
            return runSeries(this.generateDomainDotJs, buildUnpacked);
        }
    }

    // ===== Test tasks =====

    async _generateTestJson() {
        // Install a mocha hook that writes to process.env.BROWSER.
        // This is to work around the fact that gulp-mocha does not
        // have a way to set process env variables per process, and
        // setting it globally in the current process breaks parallel
        // test runs.
        await fs.mkdir(this.intermediatesDir(), { recursive: true });
        await fs.writeFile(
            `${this.intermediatesDir()}/mocha-require-${this.browser}.mjs`,
            `export const mochaHooks = () => { process.env.BROWSER = "${this.browser}" }`)
    }

    async runAutoTest() {
        await this._generateTestJson();
        await makePromise(
            () => src('test/auto/*.mjs')
                .pipe(mocha({
                    require: [`${this.intermediatesDir()}/mocha-require-${this.browser}.mjs`],
                    reporter: 'spec',
                    timeout: 100000
                }))
        );
    }

    async runManualTest() {
        await this._generateTestJson();
        await makePromise(
            () => src('test/manual/*.js')
                .pipe(mocha({
                    require: [`${this.intermediatesDir()}/mocha-require-${this.browser}.mjs`],
                    reporter: 'spec',
                    timeout: 100000
                }))
        );
    }

    async buildUnitTestDependencies() {
        return src(['src/permission.ts', 'src/Scrollability.ts'])
            .pipe(webpack({
                entry: {
                    permission: './src/permission.ts',
                    Scrollability: './src/Scrollability.ts',
                },
                output: {
                    filename: '[name].js',
                },
                resolve: {
                    extensions: ['.ts', '.js'],
                    modules: ['src', 'node_modules'],
                },
                module: {
                    rules: [
                        {
                            test: /\.ts$/,
                            loader: 'ts-loader',
                            exclude: /node_modules/,
                        }
                    ]
                },
                mode: 'development',
            }))
            .pipe(dest(`${this.pluginDir()}/src`));
    }

    runUnitTest(watch = false) {
        const task = async (done: karma.ServerCallback | undefined) => {
            let config = await karma.config.parseConfig(null, {
                frameworks: ['mocha', 'chai'],
                files: [
                    'test/unit/fakes.js',
                    `${this.pluginDir()}/src/domains.js`,
                    `${this.pluginDir()}/src/permission.js`,
                    `${this.pluginDir()}/src/Scrollability.js`,
                    'test/unit/permission_test.js',
                    'test/unit/Scrollability_test.js'
                ],
                singleRun: !watch,
                browsers: ['ChromeHeadless'],
            });
            new karma.Server(config, done).start();
        };
        task.displayName = `[${this.browser}] runUnitTest`;
        return task;
    }

    // ===== Release tasks =====

    async openStoreLink() {
        switch (this.browser) {
            case 'chrome':
                await open('https://chrome.google.com/webstore/developer/edit/jifommjndpnefcfplgnbhabocomgdjjg');
                break;
            case 'edge':
                await open('https://partner.microsoft.com/en-us/dashboard/microsoftedge/27ae3b1c-3f31-477b-b8e3-bddb29477f74/packages');
                break;
            case 'firefox':
                await open('https://addons.mozilla.org/en-US/developers/addon/scrollmaps/ownership');
                break;
            default:
                throw new Error(`Unsupported browser ${this.browser}`)
        }
    }
}

export async function testall() {
    const tasks = BROWSERS.map((browser) => {
        const bc = new BuildContext(browser, 10000);
        return series(bc.build, bc.runAutoTest);
    });
    // Cannot run in parallel because Applescript (used to trigger browser
    // action) requires window focus
    return runSeries(...tasks);
}
testall.description = 'Run tests for all browsers';

export async function test() {
    const bc = new BuildContext(getBrowser(), 10000);
    return runSeries(bc.build, bc.runAutoTest);
}
test.description = 'Run tests for a particular browser';
test.flags = BROWSER_FLAGS;

async function devBuild() {
    return new BuildContext(getBrowser(), 10000).build();
}
devBuild.description = 'Build the development version of the browser';
devBuild.flags = BROWSER_FLAGS;

async function releaseBuild() {
    const packageJsonString = await fs.readFile('package.json') as any as string;
    const packageJson = JSON.parse(packageJsonString);
    if (!packageJson.version) {
        throw new Error('Cannot get version from package.json')
    }
    const tasks = BROWSERS
        .map((browser) => new BuildContext(browser, packageJson.version))
        .map((bc) => series(bc.build, bc.zipExtension));
    await runParallel(...tasks);
}
releaseBuild.description = 'Build for all releases';


// Task to be run after running `npm version [major/minor]`
export async function postVersion() {
    const packageJsonString = await fs.readFile('package.json') as any as string;
    const packageJson = JSON.parse(packageJsonString);
    if (!packageJson.version) {
        throw new Error('Cannot get version from package.json')
    }
    const tasks = BROWSERS
        .map((browser) => new BuildContext(browser, packageJson.version))
        .map((bc) => series(bc.build, bc.zipExtension));
    await runSeries(
        parallel(...tasks),
        parallel(
            execTask('git push'),
            async () => open('gen'),
        ),
        async () => open(`https://github.com/mauricelam/ScrollMaps/releases/new?tag=v${packageJson.version}`),
    );
}
postVersion.description = 'Do not call directly. Use `npm version <major/minor>` instead.'

function watchDevBuild() {
    gulp.watch(
        [
            'src/**',
            'gulputils.js',
            'manifest_template.json',
            'manifest_chrome_template.json',
            'images/*',
            __filename,
        ],
        { events: 'all', ignoreInitial: false },
        devBuild
    )
}
watchDevBuild.description = 'Watch for changes in source files and build development builds';

async function runUnitTest() {
    const bc = new BuildContext('chrome', 10000);
    await runSeries(
        series(bc.generateDomainDotJs, bc.buildUnitTestDependencies),
        bc.runUnitTest(),
    );
}
runUnitTest.description = 'Run unit tests in a headless chrome instance';

async function watchUnitTest() {
    const bc = new BuildContext('chrome', 10000);
    const buildTest = series(bc.generateDomainDotJs, bc.buildUnitTestDependencies);
    gulp.watch(
        [
            'src/**',
            'gulputils.js',
            'manifest_template.json',
            'manifest_chrome_template.json',
            'images/*',
            __filename,
        ],
        { events: 'all' },
        buildTest
    );
    await runSeries(
        buildTest,
        bc.runUnitTest(true),
    );
}
watchUnitTest.description = 'Watch for file changes and automatically run unit tests';

export async function publish() {
    const bc = new BuildContext(getBrowser(), 10000);
    await bc.openStoreLink();
}

export async function clean() {
    return await deleteAsync(['gen/*']);
}
clean.description = 'Remove all build outputs';

// Allow --chrome, --firefox, --edge as command line args
function getBrowser(): Browser {
    const args = minimist(process.argv.slice(1));
    for (const browser of BROWSERS) {
        if (args[browser]) {
            process.env.BROWSER = browser;
        }
    }
    if (!process.env.BROWSER) {
        throw new Error('Browser must be specified with --chrome, --firefox, or --edge');
    }
    return process.env.BROWSER as Browser;
}

export default devBuild;
export const dev = devBuild;
export const release = releaseBuild;
export const unit = runUnitTest;
export const watchunit = watchUnitTest;
export const watch = watchDevBuild;
