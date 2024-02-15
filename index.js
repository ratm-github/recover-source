#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]')
    .option('input', {
        description: 'The input path to the minified JavaScript file or a directory containing multiple files',
        alias: 'i',
        type: 'string',
        demandOption: true
    })
    .help()
    .alias('help', 'h')
    .argv;

const handleFile = async (minifiedFilePath) => {
    // Check if the Source Map exists
    const sourceMapPath = minifiedFilePath + '.map';
    if (!fs.existsSync(sourceMapPath)) {
        console.error(`No source map found at ${sourceMapPath}`);
        return;
    }

    // Read the minified file and the Source Map
    const minifiedCode = fs.readFileSync(minifiedFilePath, 'utf8');
    const rawSourceMap = fs.readFileSync(sourceMapPath);
    const rawSourceMapJson = JSON.parse(rawSourceMap);

    if (!rawSourceMapJson.sourcesContent || rawSourceMapJson.sourcesContent.length <= 0) {
        throw new Error(`source map ${sourceMapPath} doesn't have a sourcesContent field`);
    }

    const seen = new Map();
    const contents = rawSourceMapJson.sourcesContent;
    const sources = rawSourceMapJson.sources;
    for (const i in contents) {
        const source = sources[i];
        const content = contents[i];
        const url = new URL(source.indexOf('://') >= 0 ?
            source :
            `file://${source}`);
        let originalPath = path.normalize(url.pathname + url.search);
        if (seen.has(originalPath)) {
            const occurrences = seen.get(originalPath);
            seen.set(originalPath, occurrences + 1);
            originalPath = `${originalPath} (${occurrences})`;
        } else {
            seen.set(originalPath, 1);
        }

        const targetPath = path.join(
            path.dirname(minifiedFilePath),
            originalPath);

        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, content);
        console.log(`Source ${source} recovered to ${targetPath}`);
    }
};

const handlePath = (inputPath) => {
    const files = fs.readdirSync(inputPath);

    for (const file of files) {
        const absolutePath = path.join(inputPath, file);

        if (fs.statSync(absolutePath).isDirectory()) {
            handlePath(absolutePath);
        } else if (path.extname(absolutePath) === '.js') {
            handleFile(absolutePath);
        }
    }
};

if (fs.statSync(argv.input).isDirectory()) {
    handlePath(argv.input);
} else {
    handleFile(argv.input);
}
