import { render } from 'preact';
import { App } from './app';
import { init } from './state';
import './styles.css';

void init();
render(<App />, document.getElementById('app')!);
