import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../App.css';
import Mpti from './Mpti';

createRoot(document.getElementById('root')!).render(<StrictMode><Mpti /></StrictMode>);
