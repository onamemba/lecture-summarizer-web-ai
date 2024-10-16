import React from 'react';
import './ProgressBar.css';

const ProgressBar = ({ progress }) => {
  return (
    <div className="progress-container">
      <label htmlFor="progress">Recording Progress:</label>
      <progress id="progress" value={progress} max="100"></progress>
    </div>
  );
};

export default ProgressBar;
