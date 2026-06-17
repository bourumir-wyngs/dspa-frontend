'use strict';

// Jest 28 requires transformers to return an object with a `code` property.
// CRA 5's bundled CSS transformer still returns a string, so this local
// transformer preserves CRA's behavior while keeping tests compatible with the
// Jest 28 migration.
module.exports = {
  process() {
    // CSS imports are not executed in unit tests; they resolve to an empty
    // object so components can import stylesheet files without jsdom styling.
    return { code: 'module.exports = {};' };
  },
  getCacheKey() {
    return 'cssTransform';
  },
};
