// Ensure window.fetch has both getter and setter defined across window, Window.prototype,
// and prototype chain so any scripts or iframe wrappers attempting to assign or wrap window.fetch do not throw
if (typeof window !== 'undefined') {
  try {
    const rawFetch = window.fetch;
    if (typeof rawFetch === 'function') {
      let currentFetch = rawFetch.bind(window);

      const getFetch = () => currentFetch;
      const setFetch = (fn: typeof fetch) => {
        currentFetch = fn;
      };

      // 1. Traverse prototypes up to Object.prototype
      let p: any = window;
      while (p && p !== Object.prototype) {
        try {
          const desc = Object.getOwnPropertyDescriptor(p, 'fetch');
          if (desc) {
            Object.defineProperty(p, 'fetch', {
              get: getFetch,
              set: setFetch,
              configurable: true,
              enumerable: true,
            });
          }
        } catch {
          // Ignore
        }
        p = Object.getPrototypeOf(p);
      }

      // 2. Window.prototype
      if (typeof Window !== 'undefined' && Window.prototype) {
        try {
          Object.defineProperty(Window.prototype, 'fetch', {
            get: getFetch,
            set: setFetch,
            configurable: true,
            enumerable: true,
          });
        } catch {
          // Ignore
        }
      }

      // 3. window instance
      try {
        Object.defineProperty(window, 'fetch', {
          get: getFetch,
          set: setFetch,
          configurable: true,
          enumerable: true,
        });
      } catch {
        // Ignore
      }
    }
  } catch {
    // Gracefully ignore
  }
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
