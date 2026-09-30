// src/pages/About.jsx
import React from 'react';
import NavigationButtons from '../components/NavigationButtons';
import './About.css';

const About = () => {
  return (
    <div className="about-page">
      <div className="bento-container">
        <div className="bento-item">
          <h2>Background</h2>
          <p>
            I'm Sherwin, a passionate computer science student with interests in cybersecurity and artificial intelligence.
          </p>
        </div>
        <div className="bento-item">
          <h2>Skills</h2>
          <ul>
            <li>Cybersecurity</li>
            <li>Artificial Intelligence</li>
            <li>Web Development</li>
            <li>Mobile App Development</li>
          </ul>
        </div>
        <div className="bento-item">
          <h2>Projects</h2>
          <ul>
            <li>Privacy Preserving Visualization Tool</li>
            <li>HTML Transformer</li>
            <li>Flutter Event Planning App</li>
          </ul>
        </div>
        <div className="bento-item">
          <h2>Contact</h2>
          <p>Email: sherwin@example.com</p>
          <p>LinkedIn: linkedin.com/in/sherwin</p>
          <p>GitHub: github.com/sherwin-w</p>
        </div>
      </div>

      {/* Navigation Buttons */}
      <NavigationButtons />
    </div>
  );
};

export default About;
