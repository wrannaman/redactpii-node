import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';

export default {
  input: 'lib/src/index.js',
  output: [
    {
      file: 'lib/index.mjs',
      format: 'es',
      sourcemap: true,
    },
  ],
  plugins: [
    nodeResolve(),
    json(),
    typescript({
      tsconfig: './tsconfig.json',
      compilerOptions: {
        module: 'esnext',
      },
      declaration: false,
      declarationMap: false,
    }),
  ],
  external: [],
};
