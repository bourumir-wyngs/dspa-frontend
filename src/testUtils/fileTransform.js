'use strict';

const path = require('path');

// Jest 28 requires transformers to return an object with a `code` property.
// CRA 5's bundled file transformer still returns a string, so this local
// transformer preserves CRA's asset import behavior for the Jest 28 migration.
function toPascalCase(value) {
  return value
    .replace(/(^\w|[-_\s]+\w)/g, (match) => match.replace(/[-_\s]+/g, '').toUpperCase())
    .replace(/[^\w]/g, '');
}

module.exports = {
  process(_src, filename) {
    const assetFilename = JSON.stringify(path.basename(filename));

    if (filename.match(/\.svg$/)) {
      const componentName = `Svg${toPascalCase(path.parse(filename).name)}`;

      return {
        // Match CRA's SVG handling: expose both the file name as the default
        // export and a lightweight ReactComponent mock for component imports.
        code: `const React = require('react');
module.exports = {
  __esModule: true,
  default: ${assetFilename},
  ReactComponent: React.forwardRef(function ${componentName}(props, ref) {
    return {
      $$typeof: Symbol.for('react.element'),
      type: 'svg',
      ref: ref,
      key: null,
      props: Object.assign({}, props, {
        children: ${assetFilename}
      })
    };
  }),
};`,
      };
    }

    // Non-code static assets such as gifs and images resolve to their basename,
    // matching CRA's test behavior without loading the real file.
    return { code: `module.exports = ${assetFilename};` };
  },
};
