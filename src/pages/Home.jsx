// src/pages/Home.jsx
import React from 'react';
import NavigationButtons from '../components/NavigationButtons';
import './Home.css';

const Home = () => {
  return (
    <div className="main-page">
      <h1 className="home-title">Hello, I'm Sherwin</h1>
      {/* Add a subtitle if desired */}
      
      {/* Navigation Buttons */}
      <NavigationButtons />
    </div>
  );
};

export default Home;
