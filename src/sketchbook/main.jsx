import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../App.css';
import './sketchbook.css';
import Sketchbook from './Sketchbook';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sketchbook />
  </StrictMode>,
);
