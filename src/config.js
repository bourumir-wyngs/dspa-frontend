import settings from './config.json';

// PUBLIC_URL is compiled into each bundle: the public site uses /, private data /db.
export const appBasePath = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
if (appBasePath && !/^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(appBasePath)) {
  throw new Error('PUBLIC_URL must be / or a local application path');
}

export const appPath = (path) => `${appBasePath}${path}`;
export const isProtectedApp = process.env.REACT_APP_DSPA_PRIVATE_APP === 'true';
export const servicesBasePath = isProtectedApp ? appBasePath : '/db';

const config = {
  ...settings,
  apiEndpoint: settings.apiEndpoint.startsWith('/')
    ? appPath(settings.apiEndpoint)
    : settings.apiEndpoint,
};

export default config;
