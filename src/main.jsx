import { render } from 'preact';
import '@fontsource/big-shoulders-display/latin-800';
import '@fontsource/ibm-plex-sans/latin-400';
import '@fontsource/ibm-plex-sans/latin-500';
import '@fontsource/ibm-plex-sans/latin-600';
import '@fontsource/ibm-plex-mono/latin-400';
import '@fontsource/ibm-plex-mono/latin-500';
import './styles.css';
import { initStore } from './lib/store.js';
import { App } from './app.jsx';
import { setupUpdates } from './lib/update.js';
import { initRestPush } from './lib/restpush.js';

initStore().then(() => render(<App />, document.getElementById('app')));
initRestPush();
setupUpdates();
