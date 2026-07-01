/**
 * Purpose: Expo entry point — registers the root App component.
 * Inputs: src/app/App.tsx default export.
 * Outputs: registered root component (Expo Go + native builds).
 * Constraints: keep as plain JS — loaded before the TS transform in some tools.
 */
import { registerRootComponent } from 'expo';
import App from './src/app/App';

registerRootComponent(App);
