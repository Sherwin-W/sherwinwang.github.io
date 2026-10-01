// src/components/Navbar.jsx
import PropTypes from 'prop-types';

const Navbar = ({ toggleSidebar }) => {
  return (
    <div className="navbar">
      <button className="hamburger" onClick={toggleSidebar}>
        &#9776;
      </button>
    </div>
  );
};

Navbar.propTypes = {
  toggleSidebar: PropTypes.func.isRequired,
};

export default Navbar;
