import esbuild from 'esbuild';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import parseArgs from 'minimist';

const BROWSERS = ['chrome', 'firefox', 'edge'];

function getGoogleMapUrls() {
  const GOOGLE_MAPS_CCTLDS = [
    "at", "au", "be", "br", "ca", "cf", "cg", "ch", "ci", "cl", "cn", "uk", "in", "jp", "th",
    "cz", "dj", "de", "dk", "ee", "es", "fi", "fr", "ga", "gm", "hk", "hr", "hu", "ie", "is",
    "it", "li", "lt", "lu", "lv", "mg", "mk", "mu", "mw", "nl", "no", "nz", "pl", "pt", "ro",
    "ru", "rw", "sc", "se", "sg", "si", "sk", "sn", "st", "td", "tg", "tr", "tw", "ua", "us"
  ];

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

function processManifestTemplate(content, browser, version) {
  let manifest = JSON.parse(content);
  const urls = getGoogleMapUrls();

  let processObj = (obj) => {
    if (Array.isArray(obj)) {
      let index = obj.indexOf('<%= all_google_maps_urls %>');
      if (index !== -1) {
        obj.splice(index, 1, ...urls);
      }
    }
    if (typeof obj === 'object' && obj !== null) {
      for (let o in obj) {
        if (typeof obj[o] === 'object') {
          processObj(obj[o]);
        }
      }
      if (browser === 'chrome') {
        if (obj.browser_specific_settings && obj.browser_specific_settings.chrome) {
          const chromeSettings = obj.browser_specific_settings.chrome;
          for (const i in chromeSettings) {
            obj[i] = chromeSettings[i];
          }
          delete obj.browser_specific_settings;
        }
      }
    }
  };

  processObj(manifest);
  manifest.version = '' + version;
  return JSON.stringify(manifest, null, 2);
}

function copyDirRecursiveSync(src, dest, filterFn) {
  if (!fsSync.existsSync(dest)) {
    fsSync.mkdirSync(dest, { recursive: true });
  }
  const entries = fsSync.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursiveSync(srcPath, destPath, filterFn);
    } else if (!filterFn || filterFn(srcPath)) {
      fsSync.mkdirSync(path.dirname(destPath), { recursive: true });
      fsSync.copyFileSync(srcPath, destPath);
    }
  }
}

async function buildBrowser(browser, version, { isRelease = false } = {}) {
  const intermediatesDir = `gen/intermediates-${version}-${browser}`;
  const pluginDir = `gen/plugin-${version}-${browser}`;

  await fs.mkdir(intermediatesDir, { recursive: true });
  await fs.mkdir(pluginDir, { recursive: true });

  // Generate domain override
  const domainOverrideFile = path.resolve(path.join(intermediatesDir, 'domains.override.ts'));
  await fs.writeFile(domainOverrideFile, `export default ${JSON.stringify(getGoogleMapUrls())};`);

  // Copy static src files (css, html)
  copyDirRecursiveSync('src', path.join(pluginDir, 'src'), (file) => file.endsWith('.css') || file.endsWith('.html'));

  // Copy images
  copyDirRecursiveSync('images', path.join(pluginDir, 'images'));

  // Process manifest
  const manifestTemplateFile = browser === 'firefox' ? 'manifest_template.json' : 'manifest_chrome_template.json';
  const manifestContent = await fs.readFile(manifestTemplateFile, 'utf8');
  const processedManifest = processManifestTemplate(manifestContent, browser, version);
  await fs.writeFile(path.join(pluginDir, 'manifest.json'), processedManifest);

  // Bundle JS/TS entry points
  const entries = {
    'inject_everywhere': './src/inject_everywhere.ts',
    'inject_frame_permission': './src/inject_frame_permission.ts',
    'inject_scrollability': './src/Scrollability.ts',
    'inject_frame': './src/inject_frame.ts',
    'inject_main': './src/inject_main.ts',
    'background': './src/background.ts',
    'options': './src/options/options.ts',
    'popup': './src/popup/popup.ts',
  };

  await esbuild.build({
    entryPoints: entries,
    outdir: pluginDir,
    entryNames: '[name].min',
    bundle: true,
    minify: true,
    sourcemap: false,
    target: 'es2020',
    alias: {
      'domains': domainOverrideFile,
    },
  });

  // Zip if firefox or release
  if (browser === 'firefox' || isRelease) {
    const zipName = `scrollmaps-${version}-${browser}.zip`;
    const zipPath = path.resolve(path.join('gen', zipName));
    const absPluginDir = path.resolve(pluginDir);
    try {
      execFileSync('zip', ['-r', zipPath, '.'], { cwd: absPluginDir, stdio: 'ignore' });
    } catch (e) {
      console.error(`Failed to zip ${pluginDir}:`, e);
    }
  }

  console.log(`Successfully built [${browser}] in ${pluginDir}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    boolean: ['chrome', 'firefox', 'edge', 'all', 'release', 'watch'],
  });

  const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
  const version = args.release ? packageJson.version : (process.env.VERSION || 10000);

  let targetBrowsers = [];
  if (args.chrome) targetBrowsers.push('chrome');
  if (args.firefox) targetBrowsers.push('firefox');
  if (args.edge) targetBrowsers.push('edge');

  if (targetBrowsers.length === 0) {
    targetBrowsers = BROWSERS;
  }

  for (const browser of targetBrowsers) {
    await buildBrowser(browser, version, { isRelease: args.release });
  }

  if (args.watch) {
    console.log('Watching for changes...');
    fsSync.watch('src', { recursive: true }, async (event, filename) => {
      console.log(`File changed: ${filename}. Rebuilding...`);
      for (const browser of targetBrowsers) {
        await buildBrowser(browser, version, { isRelease: args.release });
      }
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
