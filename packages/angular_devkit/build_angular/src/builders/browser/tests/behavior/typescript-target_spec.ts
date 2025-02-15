/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { logging } from '@angular-devkit/core';
import { buildWebpackBrowser } from '../../index';
import { BASE_OPTIONS, BROWSER_BUILDER_INFO, describeBuilder } from '../setup';

describeBuilder(buildWebpackBrowser, BROWSER_BUILDER_INFO, (harness) => {
  describe('Behavior: "TypeScript Configuration - target"', () => {
    it('downlevels async functions when targetting ES2017', async () => {
      // Set TypeScript configuration target to ES2017 to enable native async
      await harness.modifyFile('src/tsconfig.app.json', (content) => {
        const tsconfig = JSON.parse(content);
        if (!tsconfig.compilerOptions) {
          tsconfig.compilerOptions = {};
        }
        tsconfig.compilerOptions.target = 'es2017';

        return JSON.stringify(tsconfig);
      });

      // Add a JavaScript file with async code
      await harness.writeFile(
        'src/async-test.js',
        'async function testJs() { console.log("from-async-js-function"); }',
      );

      // Add an async function to the project as well as JavaScript file
      await harness.modifyFile(
        'src/main.ts',
        (content) =>
          'import "./async-test";\n' +
          content +
          `\nasync function testApp(): Promise<void> { console.log("from-async-app-function"); }`,
      );

      harness.useTarget('build', {
        ...BASE_OPTIONS,
        vendorChunk: true,
      });

      const { result } = await harness.executeOnce();

      expect(result?.success).toBe(true);
      harness.expectFile('dist/main.js').content.not.toMatch(/\sasync\s/);
      harness.expectFile('dist/main.js').content.toContain('"from-async-app-function"');
      harness.expectFile('dist/main.js').content.toContain('"from-async-js-function"');
    });

    it('creates correct sourcemaps when downleveling async functions', async () => {
      // Set TypeScript configuration target to ES2017 to enable native async
      await harness.modifyFile('src/tsconfig.app.json', (content) => {
        const tsconfig = JSON.parse(content);
        if (!tsconfig.compilerOptions) {
          tsconfig.compilerOptions = {};
        }
        tsconfig.compilerOptions.target = 'es2017';

        return JSON.stringify(tsconfig);
      });

      // Add a JavaScript file with async code
      await harness.writeFile(
        'src/async-test.js',
        'async function testJs() { console.log("from-async-js-function"); }',
      );

      // Add an async function to the project as well as JavaScript file
      // The type `Void123` is used as a unique identifier for the final sourcemap
      // If sourcemaps are not properly propagated then it will not be in the final sourcemap
      await harness.modifyFile(
        'src/main.ts',
        (content) =>
          'import "./async-test";\n' +
          content +
          '\ntype Void123 = void;' +
          `\nasync function testApp(): Promise<Void123> { console.log("from-async-app-function"); }`,
      );

      harness.useTarget('build', {
        ...BASE_OPTIONS,
        vendorChunk: true,
        sourceMap: {
          scripts: true,
        },
      });

      const { result } = await harness.executeOnce();

      expect(result?.success).toBe(true);
      harness.expectFile('dist/main.js').content.not.toMatch(/\sasync\s/);
      harness.expectFile('dist/main.js.map').content.toContain('Promise<Void123>');
    });

    it('downlevels async functions when targetting greater than ES2017', async () => {
      // Set TypeScript configuration target greater than ES2017 to enable native async
      await harness.modifyFile('src/tsconfig.app.json', (content) => {
        const tsconfig = JSON.parse(content);
        if (!tsconfig.compilerOptions) {
          tsconfig.compilerOptions = {};
        }
        tsconfig.compilerOptions.target = 'es2020';

        return JSON.stringify(tsconfig);
      });

      // Add an async function to the project
      await harness.writeFile(
        'src/main.ts',
        'async function test(): Promise<void> { console.log("from-async-function"); }',
      );

      harness.useTarget('build', {
        ...BASE_OPTIONS,
        vendorChunk: true,
      });

      const { result } = await harness.executeOnce();

      expect(result?.success).toBe(true);
      harness.expectFile('dist/main.js').content.not.toMatch(/\sasync\s/);
      harness.expectFile('dist/main.js').content.toContain('"from-async-function"');
    });

    it('downlevels "for await...of" when targetting ES2018+', async () => {
      await harness.modifyFile('src/tsconfig.app.json', (content) => {
        const tsconfig = JSON.parse(content);
        if (!tsconfig.compilerOptions) {
          tsconfig.compilerOptions = {};
        }
        tsconfig.compilerOptions.target = 'es2020';

        return JSON.stringify(tsconfig);
      });

      // Add an async function to the project
      await harness.writeFile(
        'src/main.ts',
        `
         (async () => {
           for await (const o of [1, 2, 3]) {
             console.log("for await...of");
           }
         })();
         `,
      );

      harness.useTarget('build', {
        ...BASE_OPTIONS,
        vendorChunk: true,
      });

      const { result } = await harness.executeOnce();

      expect(result?.success).toBe(true);
      harness.expectFile('dist/main.js').content.not.toMatch(/\sawait\s/);
      harness.expectFile('dist/main.js').content.toContain('"for await...of"');
    });

    it('allows optimizing global scripts with ES2015+ syntax when targetting ES5', async () => {
      await harness.modifyFile('src/tsconfig.app.json', (content) => {
        const tsconfig = JSON.parse(content);
        if (!tsconfig.compilerOptions) {
          tsconfig.compilerOptions = {};
        }
        tsconfig.compilerOptions.target = 'es5';

        return JSON.stringify(tsconfig);
      });

      // Add global script with ES2015+ syntax to the project
      await harness.writeFile(
        'src/es2015-syntax.js',
        `
           class foo {
             bar() {
               console.log('baz');
             }
           }

           (new foo()).bar();
         `,
      );

      harness.useTarget('build', {
        ...BASE_OPTIONS,
        optimization: {
          scripts: true,
        },
        scripts: ['src/es2015-syntax.js'],
      });

      const { result } = await harness.executeOnce();

      expect(result?.success).toBe(true);
    });

    it('a deprecation warning should be issued when targetting ES5', async () => {
      await harness.modifyFile('src/tsconfig.app.json', (content) => {
        const tsconfig = JSON.parse(content);
        if (!tsconfig.compilerOptions) {
          tsconfig.compilerOptions = {};
        }
        tsconfig.compilerOptions.target = 'es5';

        return JSON.stringify(tsconfig);
      });
      await harness.writeFiles({
        'src/tsconfig.worker.json': `{
          "extends": "../tsconfig.json",
          "compilerOptions": {
            "outDir": "../out-tsc/worker",
            "lib": [
              "es2018",
              "webworker"
            ],
            "types": []
          },
          "include": [
            "**/*.worker.ts",
          ]
        }`,
        'src/app/app.worker.ts': `
        /// <reference lib="webworker" />

        const prefix: string = 'Data: ';
        addEventListener('message', ({ data }) => {
          postMessage(prefix + data);
        });
      `,
      });

      harness.useTarget('build', {
        ...BASE_OPTIONS,
        webWorkerTsConfig: 'src/tsconfig.worker.json',
      });

      const { result, logs } = await harness.executeOnce();
      expect(result?.success).toBeTrue();

      const deprecationMessages = logs.filter(({ message }) =>
        message.startsWith('DEPRECATED: ES5 output is deprecated'),
      );

      expect(deprecationMessages).toHaveSize(1);
    });
  });
});
