import React from 'react';
import './RecordingControls.css';

const RecordingControls = ({ onStart, onStop, isRecording }) => {
  return (
    <div className="controls">
      <button className="material-button" onClick={onStart} disabled={isRecording}>
        <span className="material-icons">mic</span> Start Recording
      </button>
      <button className="material-button" onClick={onStop} disabled={!isRecording}>
        <span className="material-icons">stop</span> Stop Recording
      </button>
    </div>
  );
};

export default RecordingControls;
