import { build, context, transform } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { watch } from 'node:fs';

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

const configs = banner => {
    const shared = {
        entryPoints: ['src/index.js'],
        bundle: true,
        format: 'iife',
        jsxFactory: 'h',
        jsxFragment: 'Fragment',
    };
    return [
        { ...shared, banner: { js: banner }, plugins: [cssText(false)], outfile: 'dist/bookstack-tables-extended.js' },
        { ...shared, minify: true, plugins: [cssText(true)], outfile: 'dist/bookstack-tables-extended.min.js' },
    ];
};

const readBanner = () => readFile('src/banner.txt', 'utf-8');

if (process.argv.includes('--watch')) {
    // esbuild takes the banner as a fixed string, so contexts are recreated when banner.txt changes.
    let contexts = [];
    const start = async () => {
        const old = contexts;
        contexts = await Promise.all(configs(await readBanner()).map(c => context(c)));
        await Promise.all(contexts.map(c => c.watch()));
        await Promise.all(old.map(c => c.dispose()));
    };
    await start();
    watch('src/banner.txt', () => start().catch(console.error));
    console.log('Watching src/ ...');
} else {
    await Promise.all(configs(await readBanner()).map(c => build(c)));
}
