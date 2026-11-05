import React, { useEffect, useState } from 'react';
import config, { isProtectedApp, servicesBasePath } from '../config';

function ServicesBox() {
  const [userId, setUserId] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  useEffect(() => {
    if (!isProtectedApp) {
      setIsLoadingUser(false);
      return undefined;
    }
    const controller = new AbortController();

    const loadUser = async () => {
      try {
        const response = await fetch(`${config.apiEndpoint}user`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Unable to load user');
        const data = await response.json();
        if (!controller.signal.aborted) {
          setUserId(typeof data.userId === 'string' && data.userId ? data.userId : null);
        }
      } catch (error) {
        if (!controller.signal.aborted) setUserId(null);
      } finally {
        if (!controller.signal.aborted) setIsLoadingUser(false);
      }
    };

    loadUser();
    return () => controller.abort();
  }, []);

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    setLogoutError('');
    try {
      const response = await fetch(`${servicesBasePath}/auth/logout`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      // An expired session is already logged out.
      if (!response.ok && response.status !== 401) throw new Error('Logout failed');
      window.location.replace('/');
    } catch (error) {
      setLogoutError('Could not log out. Please try again.');
      setIsLoggingOut(false);
    }
  };

  return (
    <section className="box services-box" aria-labelledby="services-heading">
      <div className="box-content">
        <h2 id="services-heading">Services</h2>
      </div>
      <div className="box-actions services-actions">
        <button type="button" onClick={() => window.location.assign(`${servicesBasePath}/importer/`)}>
          Import data
        </button>
        <button type="button" onClick={() => window.location.assign(`${servicesBasePath}/adminer/`)}>
          Direct SQL
        </button>
        {isProtectedApp ? <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          title={`User ${isLoadingUser ? 'Loading…' : userId || 'unavailable'}`}
        >
          {isLoggingOut ? 'Logging out…' : 'Logout'}
        </button> : <button type="button" onClick={() => window.location.assign(`${servicesBasePath}/`)}>
          My data
        </button>}
      </div>
      {logoutError && <p role="alert">{logoutError}</p>}
    </section>
  );
}

export default ServicesBox;
