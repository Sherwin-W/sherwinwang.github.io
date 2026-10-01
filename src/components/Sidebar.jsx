// src/components/Sidebar.jsx
import PropTypes from 'prop-types';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <ul>
        <li>
          <Link
            to="/"
            onClick={toggleSidebar}
            className={currentPath === '/' ? 'active' : ''}
          >
            Home
          </Link>
        </li>
        <li>
          <Link
            to="/about"
            onClick={toggleSidebar}
            className={currentPath === '/about' ? 'active' : ''}
          >
            About Me
          </Link>
        </li>
        <li>
          <Link
            to="/projects"
            onClick={toggleSidebar}
            className={currentPath === '/projects' ? 'active' : ''}
          >
            My Projects
          </Link>
        </li>
        <li>
          <Link
            to="/contact"
            onClick={toggleSidebar}
            className={currentPath === '/contact' ? 'active' : ''}
          >
            Contact Me
          </Link>
        </li>
      </ul>
    </div>
  );
};

Sidebar.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggleSidebar: PropTypes.func.isRequired,
};

export default Sidebar;
