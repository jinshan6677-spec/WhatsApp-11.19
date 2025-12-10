/**
 * esbuild 配置 - 打包快捷回复 React 组件
 */

const esbuild = require('esbuild');
const path = require('path');

const isWatch = process.argv.includes('--watch');
const isDev = process.argv.includes('--dev');

const config = {
  entryPoints: [path.join(__dirname, 'entry.jsx')],
  bundle: true,
  outfile: path.join(__dirname, 'dist', 'quick-reply.bundle.js'),
  format: 'iife',
  globalName: 'QuickReplyApp',
  platform: 'browser',
  target: ['chrome100'],
  minify: !isDev,
  sourcemap: isDev,
  loader: {
    '.jsx': 'jsx',
    '.js': 'jsx',
    '.css': 'css'
  },
  jsx: 'automatic',
  define: {
    'process.env.NODE_ENV': isDev ? '"development"' : '"production"'
  },
  external: ['electron'],
  // 注入 React 到全局
  inject: [],
  // CSS 单独输出
  plugins: []
};

async function build() {
  try {
    if (isWatch) {
      const ctx = await esbuild.context(config);
      await ctx.watch();
      console.log('[esbuild] Watching for changes...');
    } else {
      await esbuild.build(config);
      console.log('[esbuild] Build completed: dist/quick-reply.bundle.js');
    }
  } catch (error) {
    console.error('[esbuild] Build failed:', error);
    process.exit(1);
  }
}

build();
