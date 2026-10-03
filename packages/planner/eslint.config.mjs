import { fileURLToPath } from 'node:url';
import prettier from 'eslint-config-prettier/flat';
import { readability } from '../../scripts/eslint/readability.mjs';

const packageRoot = fileURLToPath(new URL('.', import.meta.url));

export default [...readability({ files: ['src/**/*.ts'], tsconfigRootDir: packageRoot }), prettier];
