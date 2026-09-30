// src/pages/Contact.jsx
import React, { useRef } from 'react';
import emailjs from 'emailjs-com';
import NavigationButtons from '../components/NavigationButtons';
import './Contact.css';

const Contact = () => {
  const form = useRef();

  const sendEmail = (e) => {
    e.preventDefault();

    emailjs.sendForm('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', form.current, 'YOUR_USER_ID')
      .then((result) => {
          console.log(result.text);
          alert('Message sent successfully!');
          form.current.reset();
      }, (error) => {
          console.log(error.text);
          alert('An error occurred, please try again.');
      });
  };

  return (
    <div className="contact-page">
      <h1>Contact Me</h1>

      <div className="social-buttons">
        <a href="https://linkedin.com/in/your-linkedin-profile" target="_blank" rel="noopener noreferrer" className="social-button linkedin">
          LinkedIn
        </a>
        <a href="https://github.com/your-github-username" target="_blank" rel="noopener noreferrer" className="social-button github">
          GitHub
        </a>
      </div>

      <form ref={form} onSubmit={sendEmail} className="contact-form">
        <div className="form-group">
          <input type="text" name="firstName" placeholder="First Name" required />
          <input type="text" name="lastName" placeholder="Last Name" required />
        </div>
        <div className="form-group">
          <input type="text" name="contactInfo" placeholder="Email or Phone Number" required />
        </div>
        <div className="form-group">
          <textarea name="message" placeholder="Your Message" required></textarea>
        </div>
        <button type="submit" className="send-button">Send</button>
      </form>

      {/* Navigation Buttons */}
      <NavigationButtons />
    </div>
  );
};

export default Contact;
