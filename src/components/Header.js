import React from 'react';
import './Header.css'; // Import the CSS for styling


const Header = () => {
  return (
    <header className="header">
      <h1 className="title">Your App Title</h1>
      <nav className="navigation">
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/about">About</a></li>
          <li><a href="/login">Login</a></li> {/* Change to Sign Out if user is authenticated */}
          {/* Add conditional rendering here based on authentication state */}
        </ul>
      </nav>
    </header>
  );
};

export default Header;