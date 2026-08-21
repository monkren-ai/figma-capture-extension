const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const srcDir = path.join(__dirname, '..', 'src');
const distDir = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const files = ['popup.js', 'background.js', 'inpage-toolbar.js', 'runner.js'];

async function build() {
  for (const file of files) {
    const srcPath = path.join(srcDir, file);
    const distPath = path.join(distDir, file);
    
    if (!fs.existsSync(srcPath)) {
      console.log(`Skipping ${file} - source not found`);
      continue;
    }
    
    try {
      await esbuild.build({
        entryPoints: [srcPath],
        bundle: false,
        minify: false,
        outfile: distPath,
        format: 'iife',
        target: ['chrome110'],
        platform: 'browser',
      });
      console.log(`Built: ${file}`);
    } catch (error) {
      console.error(`Error building ${file}:`, error);
    }
  }
  
  const i18nSrc = path.join(srcDir, 'i18n.js');
  const i18nDist = path.join(distDir, 'i18n.js');
  if (fs.existsSync(i18nSrc)) {
    fs.copyFileSync(i18nSrc, i18nDist);
    console.log('Copied: i18n.js');
  }
  
  console.log('\nBuild complete!');
}

const args = process.argv.slice(2);
if (args.includes('--watch')) {
  console.log('Watching for changes...');
  
  files.forEach(file => {
    const srcPath = path.join(srcDir, file);
    if (fs.existsSync(srcPath)) {
      fs.watchFile(srcPath, { interval: 1000 }, () => {
        console.log(`File changed: ${file}`);
        build();
      });
    }
  });
  
  const i18nSrc = path.join(srcDir, 'i18n.js');
  if (fs.existsSync(i18nSrc)) {
    fs.watchFile(i18nSrc, { interval: 1000 }, () => {
      console.log('File changed: i18n.js');
      build();
    });
  }
} else {
  build();
}
