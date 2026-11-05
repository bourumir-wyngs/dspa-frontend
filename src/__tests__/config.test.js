const originalPublicUrl = process.env.PUBLIC_URL;
const originalPrivateApp = process.env.REACT_APP_DSPA_PRIVATE_APP;

beforeEach(() => {
  delete process.env.REACT_APP_DSPA_PRIVATE_APP;
});

afterEach(() => {
  if (originalPublicUrl === undefined) delete process.env.PUBLIC_URL;
  else process.env.PUBLIC_URL = originalPublicUrl;
  if (originalPrivateApp === undefined) delete process.env.REACT_APP_DSPA_PRIVATE_APP;
  else process.env.REACT_APP_DSPA_PRIVATE_APP = originalPrivateApp;
  jest.resetModules();
});

test.each(['', '/'])('public build %p retains root APIs and links to protected services', (base) => {
  process.env.PUBLIC_URL = base;
  const config = require('../config');
  expect(config.default.apiEndpoint).toBe('/api/v1/');
  expect(config.appPath('/experiment/DPX1')).toBe('/experiment/DPX1');
  expect(config.servicesBasePath).toBe('/db');
  expect(config.isProtectedApp).toBe(false);
});

test.each(['/db', '/db/'])('protected build %p keeps API and raw links inside its mount', (base) => {
  process.env.PUBLIC_URL = base;
  process.env.REACT_APP_DSPA_PRIVATE_APP = 'true';
  const config = require('../config');
  expect(config.default.apiEndpoint).toBe('/db/api/v1/');
  expect(config.appPath('/experiment/DPX1')).toBe('/db/experiment/DPX1');
  expect(config.appPath('/images/dpa_logo.svg')).toBe('/db/images/dpa_logo.svg');
  expect(config.servicesBasePath).toBe('/db');
  expect(config.isProtectedApp).toBe(true);
});

test('root-mounted private development build retains its original service paths', () => {
  process.env.PUBLIC_URL = '/';
  process.env.REACT_APP_DSPA_PRIVATE_APP = 'true';
  const config = require('../config');
  expect(config.default.apiEndpoint).toBe('/api/v1/');
  expect(config.servicesBasePath).toBe('');
  expect(config.isProtectedApp).toBe(true);
});

test.each(['https://other.example/db', '//other.example/db', '/db/../public', '/db?x=1'])(
  'rejects an external or ambiguous application base %p', (base) => {
    process.env.PUBLIC_URL = base;
    expect(() => require('../config')).toThrow('local application path');
  },
);
