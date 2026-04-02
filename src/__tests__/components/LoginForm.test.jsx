import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import LoginForm from '../../components/LoginForm';

describe('LoginForm', () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
  });

  it('submits the entered username and password', () => {
    const onLogin = jest.fn();

    act(() => {
      root.render(<LoginForm onLogin={onLogin} />);
    });

    const [usernameInput, passwordInput] = container.querySelectorAll('input');
    const form = container.querySelector('form');

    act(() => {
      Simulate.change(usernameInput, { target: { value: 'lipatlas' } });
      Simulate.change(passwordInput, { target: { value: 'lipatlas' } });
    });

    act(() => {
      Simulate.submit(form);
    });

    expect(onLogin).toHaveBeenCalledWith('lipatlas', 'lipatlas');
  });
});