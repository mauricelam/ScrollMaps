var open = require('open');

module.exports = function(grunt) {

grunt.loadNpmTasks('grunt-contrib-compress');
grunt.loadNpmTasks('grunt-contrib-copy');
grunt.loadNpmTasks('grunt-contrib-uglify');
grunt.loadNpmTasks('grunt-contrib-imagemin');
grunt.loadNpmTasks('grunt-newer');
grunt.loadNpmTasks('grunt-exec');

grunt.initConfig({
    uglify: {
        all: {
            files: [{
                dest: '<%= pluginDir %>/inject_content.min.js',
                src: ['src/inject_content.js']
            }]
        }
    },
    copy: {
        all: {
            files: [{
                expand: true,
                src: [
                    'src/*.js',
                    'options/*.js',
                    'options/*.html'
                ],
                dest: '<%= pluginDir %>'
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
        }
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
        }
    },
    exec: {
        chrome_extension_reload: '(./chrome-cli open chrome://extensions && ./chrome-cli reload && ./chrome-cli close) || echo "Skipping chrome reload"',
        // commit: 'git commit -a -m "Release version <%= version %>"',
        // Make sure git doesn't have uncommitted changes
        git_clean: 'git diff-index --quiet HEAD -- && git ls-files --exclude-standard --others || echo "Git status is dirty. Please commit your changes before releasing"; exit 105',
        npm_version: 'npm --no-git-tag-version version <%= version %>"',
        npm_get_version: 'npm --no-git-tag-version version <%= version %>"'
    },
    open: {
        github_release: 'https://github.com/mauricelam/ScrollMaps/releases/new?tag=<%= version %>',
        webstore: 'https://chrome.google.com/webstore/developer/edit/jifommjndpnefcfplgnbhabocomgdjjg'
    },
    imagemin: {
        dynamic: {
            files: [{
                expand: true,
                src: ['images/**/*.png'],
                dest: '<%= pluginDir %>'
            }]
        }
    }
});

grunt.registerMultiTask('open', function() {
    open(this.data);
});

grunt.registerTask('build', [
    'uglify:all',
    'copy:all',
    'copy:manifest',
    'newer:imagemin']);

grunt.registerTask('dev', [
    'set_version:10000',
    'build',
    'exec:chrome_extension_reload']);

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
    'open:github_release',
    'open:webstore']);

grunt.registerTask('version', ['exec:npm_version'])

grunt.registerTask('set_version', (version) => {
    if (!version) grunt.fatal(`Invalid version "${version}"`);
    grunt.config.set('pluginDir', `gen/plugin-${version}`);
    grunt.config.set('version', version);
});

// ========== Generate manifest ========== //

function processManifestTemplate(content) {
    let manifest = JSON.parse(content);
    function processObj(obj) {
        if (typeof obj === 'object') {
            for (o in obj) {
                if (obj[o] === '<%= all_google_maps_urls %>') {
                    obj[o] = getGoogleMapUrls();
                } else if (typeof obj[o] === 'object') {
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
        "it", "jp", "li", "lt", "lu", "lv", "mg", "mk", "mu", "mw", "nl", "no", "pl", "pt", "ro",
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
        output = output.concat(GOOGLE_MAPS_SPECIAL_URLS)
    }
    return output
}

// ========== Manual Test Sites ========== //

const TEST_SITES = [
    'https://developers.google.com/maps/documentation/javascript/styling',
    'https://developers.google.com/maps/documentation/embed/guide',
    'http://maps.google.com/?force=tt',
    'http://maps.google.be/',
    'http://en.parkopedia.com/parking/san_francisco_ca_united_states/?ac=1&country=US&lat=37.7749295&lng=-122.41941550000001',
    'https://developers.google.com/maps/documentation/javascript/signedin',
    'https://developers.google.com/maps/documentation/javascript/examples/polygon-draggable',
    'https://developers.google.com/maps/documentation/javascript/examples/layer-data-quakes',
    'https://developers.google.com/maps/documentation/javascript/examples/layer-georss',
    'https://developers.google.com/maps/documentation/javascript/examples/streetview-embed',
    'https://developers.google.com/maps/documentation/javascript/examples/drawing-tools',
    'https://www.google.com/maps/@?force=lite&dg=opt&newdg=1',
    'https://www.google.com/fusiontables/DataSource?docid=1jtmdb0D2ykY3_OmNhqiyBoiiv9B3jLNZBIffVMKR\#map:id=4',
    'https://www.google.com/maps/d/viewer?mid=1ZpcZ8OMZh1G1XwRmt9GaCwH6f-g&amp%3Bhl=en',
    'https://www.geckoboard.com/tech-acquisitions/'];

const MAPBOX_TEST_SITES = [
    'https://www.wunderground.com/'];

};