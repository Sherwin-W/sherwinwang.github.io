// src/pages/Projects.jsx
import React from 'react';
import NavigationButtons from '../components/NavigationButtons';
import './Projects.css';

const projects = [
  {
    title: 'Privacy Preserving Visualization Tool',
    description: 'A tool to visualize data while preserving privacy using differential privacy techniques.',
  },
  {
    title: 'HTML Transformer',
    description: 'A utility to transform and manipulate HTML documents efficiently.',
  },
  {
    title: 'Flutter Event Planning App',
    description: 'A mobile application built with Flutter to help users plan and organize events.',
  },
];

const Projects = () => {
  return (
    <div className="projects-page">
      <h1>My Projects</h1>
      <div className="projects-container">
        {projects.map((project, index) => (
          <div className="project-widget" key={index}>
            <h2>{project.title}</h2>
            <p>{project.description}</p>
            {/* Add links to GitHub or demos if available */}
          </div>
        ))}
      </div>

      {/* Navigation Buttons */}
      <NavigationButtons />
    </div>
  );
};

export default Projects;
