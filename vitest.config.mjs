import { defineConfig } from 'vitest/config';
import path from 'node:path';
import os from 'node:os';
export default defineConfig({ cacheDir:path.join(process.env.OCV_DEPS_ROOT||path.join(os.tmpdir(),'ocv-tests'),'cache/vitest'), test:{include:['tests/**/*.test.mjs'],exclude:['tests/research-display.test.mjs'],maxWorkers:1,fileParallelism:false} });
