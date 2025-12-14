import React from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/index.css';
import './styles/historyPerson.css';
import './styles/historyPersonDetalied.css';
import './styles/orderForPredictingYear.css';
import './styles/YearStartPage.css';
import YearDeterminationApp from './YearDeterminationApp';
import { BrowserRouter } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';
import { Provider } from 'react-redux';
import { store } from './store/store';

console.log('Entry loaded');

// // debug: mark root before React mounts
// const rootEl = document.getElementById('root') as HTMLElement | null;
// if (rootEl) {
//   rootEl.innerText = 'React mounting...';
//   rootEl.style.backgroundColor = '#fffaf0';
//   rootEl.style.color = '#000';
//   rootEl.style.padding = '20px';
// }

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <Provider store={store}>
  <BrowserRouter>
    <ErrorBoundary>
      <YearDeterminationApp />
    </ErrorBoundary>
  </BrowserRouter>
  </Provider>
);
