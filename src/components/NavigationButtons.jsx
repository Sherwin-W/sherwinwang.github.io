// src/components/NavigationButtons.jsx
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

const NavigationButtons = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const pages = ['/', '/about', '/projects', '/contact'];
  const currentIndex = pages.indexOf(location.pathname);

  const handlePrevious = () => {
    const prevIndex = (currentIndex - 1 + pages.length) % pages.length;
    navigate(pages[prevIndex]);
  };

  const handleNext = () => {
    const nextIndex = (currentIndex + 1) % pages.length;
    navigate(pages[nextIndex]);
  };

  return (
    <div className="navigation-buttons">
      {/* Conditionally render < button if not on first page */}
      {currentIndex > 0 && (
        <motion.button
          className="nav-button"
          onClick={handlePrevious}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          aria-label="Previous Page"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          &lt;
        </motion.button>
      )}
      {/* Conditionally render > button if not on last page */}
      {currentIndex < pages.length - 1 && (
        <motion.button
          className="nav-button"
          onClick={handleNext}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          aria-label="Next Page"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          &gt;
        </motion.button>
      )}
    </div>
  );
};

export default NavigationButtons;
