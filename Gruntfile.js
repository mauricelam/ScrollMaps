const open = require('open');
const { execSync } = require('child_process')

module.exports = function(grunt) {

grunt.loadNpmTasks('grunt-contrib-compress');
grunt.loadNpmTasks('grunt-contrib-concat');
grunt.loadNpmTasks('grunt-contrib-copy');
grunt.loadNpmTasks('grunt-contrib-uglify');
grunt.loadNpmTasks('grunt-contrib-watch');
grunt.loadNpmTasks('grunt-mocha-test');
grunt.loadNpmTasks('grunt-newer');
grunt.loadNpmTasks('grunt-exec');
grunt.loadNpmTasks('grunt-env');

grunt.initConfig({
    uglify: {
        all: {
            files: [
                {
                    dest: '<%= pluginDir %>/inject_content.min.js',
                    src: ['src/inject_content.js']
                },
                {
                    dest: '<%= pluginDir %>/mapapi_inject.min.js',
                    src: [
                        "node_modules/jquery/dist/jquery.min.js",
                        "src/Shim.js",
                        "src/prefreader.js",
                        "src/Scrollability.js",
                        "src/ScrollableMap.js",
                        "src/mapapi_inject.js"
                    ]
                },
                {
                    dest: '<%= pluginDir %>/scrollability_inject.min.js',
                    src: [
                        "node_modules/jquery/dist/jquery.min.js",
                        "src/Scrollability.js"
                    ]
                },
                {
                    dest: '<%= pluginDir %>/inject_frame.min.js',
                    src: [
                        "node_modules/jquery/dist/jquery.min.js",
                        "src/Shim.js",
                        "src/prefreader.js",
                        "src/Scrollability.js",
                        "src/ScrollableMap.js",
                        "src/inject_frame.js"
                    ]
                }
            ]
        }
    },
    concat: {
        options: {
            process: function(src, filepath) {
                // Double inclusion guard, since webrequest can inject the script
                // many times
                let name = filepath.split('/')
                name = name[name.length - 1]
                return `if (!window["..SMLoaded:${name}"]) {` + src +
                    `window["..SMLoaded:${name}"]=true;}`;
            }
        },
        all: {
            files: [
                {
                    dest: '<%= pluginDir %>/inject_content.min.js',
                    src: ['<%= pluginDir %>/inject_content.min.js']
                },
                {
                    dest: '<%= pluginDir %>/mapapi_inject.min.js',
                    src: ['<%= pluginDir %>/mapapi_inject.min.js']
                },
                {
                    dest: '<%= pluginDir %>/scrollability_inject.min.js',
                    src: ['<%= pluginDir %>/scrollability_inject.min.js']
                },
                {
                    dest: '<%= pluginDir %>/inject_frame.min.js',
                    src: ['<%= pluginDir %>/inject_frame.min.js']
                }
            ]
        }
    },
    copy: {
        all: {
            files: [{
                expand: true,
                src: [
                    'src/**/*.js',
                    'src/**/*.css',
                    'src/**/*.html',
                ],
                dest: '<%= pluginDir %>'
            }]
        },
        node_modules: {
            files: [{
                src: [
                    'node_modules/jquery/dist/jquery.min.js',
                ],
                dest: '<%= pluginDir %>/src/jquery.js'
            }]
        },
        manifest: {
            files: [{
                src: ['manifest_template.json'],
                dest: '<%= pluginDir %>/manifest.json'
            }],
            options: {
                process: processManifestTemplate
            }
        },
        images: {
            files: [{
                expand: true,
                src: ['images/**/*.png'],
                dest: '<%= pluginDir %>'
            }]
        },
    },
    compress: {
        release: {
            options: {
                archive: 'gen/scrollmaps-<%= version %>.zip'
            },
            files: [{
                expand: true,
                cwd: '<%= pluginDir %>',
                src: ['**'],
                dest: '/'
            }]
        },
        firefoxtest: {
            options: {
                archive: 'gen/scrollmaps-<%= version %>.zip'
            },
            files: [{
                expand: true,
                cwd: '<%= pluginDir %>',
                src: ['**'],
                dest: '/'
            }]
        }
    },
    exec: {
        git_push: 'git push',
        npm_version: 'npm version <%= version %>"'
    },
    open: {
        gen_dir: 'gen',
        github_release: 'https://github.com/mauricelam/ScrollMaps/releases/new?tag=v<%= version %>',
        webstore: 'https://chrome.google.com/webstore/developer/edit/jifommjndpnefcfplgnbhabocomgdjjg'
    },
    mochaTest: {
        all: {
            options: {
                reporter: 'spec',
                noFail: false // Optionally set to not fail on failed tests (will still fail on other errors)
            },
        },
        manual: {
            src: ['test/manual/*.js']
        },
        semimanual: {
            src: ['test/semimanual/*.js']
        },
        auto: {
            src: ['test/auto/*.js']
        }
    },
    watch: {
        all: {
            files: [
                'Gruntfile.js',
                'src/**/*.js',
                'src/**/*.html',
                'src/**/*.css',
                'manifest_template.json'
            ],
            tasks: ['dev'],
            options: {
                atBegin: true
            }
        }
    },
    env: {
        chrome: {
            BROWSER: 'chrome'
        },
        firefox: {
            BROWSER: 'firefox'
        }
    }
});

grunt.registerMultiTask('open', function() {
    open(this.data);
});

grunt.registerTask('build', [
    'uglify:all',
    'concat:all',
    'generate_domains',
    'copy:all',
    'copy:node_modules',
    'copy:manifest',
    'newer:copy:images']);

grunt.registerTask('dev', [
    'set_version:10000',
    'build',
]);

grunt.registerTask('release', function () {
    let pkg = grunt.file.readJSON('package.json')
    grunt.task.run([
        `set_version:${pkg.version || ''}`,
        'build',
        'compress:release'
    ]);
});

// TODO: move to npm directly?
grunt.registerTask('postversion', [
    'release',
    'open:gen_dir',
    'exec:git_push',
    'open:github_release',
    'open:webstore']);

grunt.registerTask('version', ['exec:npm_version'])

grunt.registerTask('set_version', (version) => {
    if (!version) grunt.fatal(`Invalid version "${version}"`);
    grunt.config.set('pluginDir', `gen/plugin-${version}`);
    grunt.config.set('version', version);
});

grunt.registerTask('generate_domains', () => {
    let urls = getGoogleMapUrls();
    let pluginDir = grunt.config.get('pluginDir');
    grunt.file.write(
        `${pluginDir}/src/domains.js`,
        'const SCROLLMAPS_DOMAINS = ' + JSON.stringify(urls));
});

// ========== Generate manifest ========== //

function processManifestTemplate(content) {
    let manifest = JSON.parse(content);
    function processObj(obj) {
        if (Array.isArray(obj)) {
            let index = obj.indexOf('<%= all_google_maps_urls %>');
            if (index !== -1) {
                obj.splice(index, 1, ...getGoogleMapUrls());
            }
        }
        if (typeof obj === 'object') {
            for (let o in obj) {
                if (typeof obj[o] === 'object') {
                    processObj(obj[o]);
                }
            }
        }
    }
    processObj(manifest)
    manifest['version'] = "" + grunt.config.get('version');
    return JSON.stringify(manifest, null, '  ');
}

function getGoogleMapUrls() {
    const GOOGLE_MAPS_CCTLDS = [
        "at", "au", "be", "br", "ca", "cf", "cg", "ch", "ci", "cl", "cn", "uk", "in", "jp", "th",
        "cz", "dj", "de", "dk", "ee", "es", "fi", "fr", "ga", "gm", "hk", "hr", "hu", "ie", "is",
        "it", "li", "lt", "lu", "lv", "mg", "mk", "mu", "mw", "nl", "no", "nz", "pl", "pt", "ro",
        "ru", "rw", "sc", "se", "sg", "si", "sk", "sn", "st", "td", "tg", "tr", "tw", "ua", "us"]

    const GOOGLE_MAPS_URL_FORMATS = [
        "*://www.google.{tld}/maps*",
        "*://www.google.com.{tld}/maps*",
        "*://www.google.co.{tld}/maps*",
        "*://maps.google.{tld}/*",
        "*://maps.google.com.{tld}/*",
        "*://maps.google.co.{tld}/*"
    ]

    const GOOGLE_MAPS_SPECIAL_URLS = [
        "*://www.google.com/maps*",
        "*://maps.google.com/*",
        "*://mapy.google.pl/*",
        "*://ditu.google.cn/*"
    ]


    let output = []
    for (tld of GOOGLE_MAPS_CCTLDS) {
        for (format of GOOGLE_MAPS_URL_FORMATS) {
            output.push(format.replace('{tld}', tld))
        }
    }
    output = output.concat(GOOGLE_MAPS_SPECIAL_URLS)
    return output
}

// ========== Manual Test Sites ========== //

// const MAPBOX_TEST_SITES = [
//     'http://en.parkopedia.com/parking/san_francisco_ca_united_states/?ac=1&country=US&lat=37.7749295&lng=-122.41941550000001',
//     'https://www.wunderground.com/'
// ];

// ========== Unit tests ========== //

grunt.registerTask('test', (browser, test) => {
    if (!browser || !test) {
        console.error('Usage: grunt test:<chrome|firefox>:<auto|semimanual|manual>');
        return;
    }
    grunt.task.run([
        'dev',
        'compress:firefoxtest',
        `env:${browser}`,
        `mochaTest:${test}`
    ]);
});

};
