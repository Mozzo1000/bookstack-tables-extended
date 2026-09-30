import { build, context, transform } from 'esbuild';
import { readFile } from 'node:fs/promises';

const banner = await readFile('src/banner.txt', 'utf-8');

const cssText = minify => ({
    name: 'css-text',
    setup(b) {
        b.onLoad({filter: /\.css$/ }, async args => {
            const source = await readFile(args.path, 'utf-8');
            const { code } = await transform(source, { loader: 'css', minify });
            return { contents: code, loader: 'text' };
        });
    },
});

const shared = {
    entryPoints: ['src/index.js'],
    bundle: true,
    format: 'iife',
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    banner: { js: banner },
};

const full = { ...shared, plugins: [cssText(false)], outfile: 'dist/bookstack-tables-extended.js' };
const min = { ...shared, minify: true, plugins: [cssText(true)], outfile: 'dist/bookstack-tables-extended.min.js' };

if (process.argv.includes('--watch')) {
    const ctx = await context(full);
    await ctx.watch()
    console.log('Watching src/ ...');
} else {
    await Promise.all([build(full), build(min)]);
}