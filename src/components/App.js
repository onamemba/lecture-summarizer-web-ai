import React, { useState, useRef, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';
import axios from 'axios';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import AudioMotionAnalyzer from 'audiomotion-analyzer'; // Import AudioMotionAnalyzer
import '@mui/material/styles'; // Ensure Material UI styling is imported
import './App.css'; // Custom CSS for your layout

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState('');
  const [transcription, setTranscription] = useState('');
  const [summary, setSummary] = useState('');
  const waveformRef = useRef(null);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const recognitionRef = useRef(null);
  const audioMotionAnalyzerRef = useRef(null); // Create a ref for AudioMotionAnalyzer
  const audioContextRef = useRef(null); // Create a ref for AudioContext

  useEffect(() => {
    if (!waveformRef.current) {
      waveformRef.current = WaveSurfer.create({
        container: '#waveform',
        waveColor: '#3f51b5',
        progressColor: '#303f9f',
        cursorWidth: 1,
        cursorColor: '#000',
        hideScrollbar: true,
      });
    }
  }, []);

  const startRecording = async () => {
    setIsRecording(true);
    audioChunks.current = [];

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder.current = new MediaRecorder(stream);
    mediaRecorder.current.start();

    mediaRecorder.current.ondataavailable = (event) => {
      audioChunks.current.push(event.data);
    };

    mediaRecorder.current.onstop = () => {
      const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      setAudioURL(audioUrl);
      waveformRef.current.load(audioUrl);
    };

    recognitionRef.current = new window.webkitSpeechRecognition();
    recognitionRef.current.lang = 'en-US';
    recognitionRef.current.interimResults = true;
    recognitionRef.current.continuous = true;

    recognitionRef.current.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
    
      if (event.results[event.resultIndex].isFinal) {
        setTranscription((prev) => prev + ' ' + transcript);
      }
    };

    recognitionRef.current.start();

    // Initialize AudioContext
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Create a MediaStreamAudioSourceNode from the microphone stream
    const source = audioContextRef.current.createMediaStreamSource(stream);

    // Initialize AudioMotionAnalyzer with the source node
    audioMotionAnalyzerRef.current = new AudioMotionAnalyzer(document.getElementById('visualizer'), {
      source: source,
      height: 400,
      ansiBands: false,
      showScaleX: false,
      bgAlpha: 0,
      overlay: true,
      smoothing: 0.7,
      mode: 0,
      channelLayout: "single",
      frequencyScale: "bark",
      gradient: "prism",
      linearAmplitude: true,
      linearBoost: 1.8,
      mirror: 0,
      radial: false,
      reflexAlpha: 0.25,
      reflexBright: 1,
      reflexFit: true,
      reflexRatio: 0.3,
      showPeaks: true,
      weightingFilter: "D"
    });
  };

  const stopRecording = () => {
    setIsRecording(false);
    mediaRecorder.current.stop();
    recognitionRef.current.stop();
    
    // Stop the audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null; // Reset the AudioContext for next recording
    }
  };

  const playAudio = () => {
    waveformRef.current.playPause();
  };

  const saveAudio = () => {
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = audioURL;
    a.download = 'recording.wav';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const summarizeTranscript = async () => {
    if (!transcription) return;

    try {
      const response = await axios.post(
        'https://api-inference.huggingface.co/models/facebook/bart-large-cnn',
        { inputs: transcription },
        {
          headers: {
            Authorization: `Bearer ${process.env.REACT_APP_HUGGINGFACE_API_KEY}`,
          },
        }
      );

      setSummary(response.data[0].summary_text);
    } catch (error) {
      console.error('Error generating summary:', error);
    }
  };

  return (
    <div className="container">
      <h1>Lee Summary</h1>
      <div className="controls">
        <button className="material-button" onClick={startRecording} disabled={isRecording}>
          <MicIcon /> Start Recording
        </button>
        <button className="material-button" onClick={stopRecording} disabled={!isRecording}>
          <StopIcon /> Stop Recording
        </button>
      </div>

      {/* AudioMotion Visualizer */}
      <div id="visualizer" style={{ margin: '1rem 0', height: '300px' }}></div>

      <div id="waveform" className="waveform"></div>
      <div className="control-buttons">
        <button className="material-button" onClick={playAudio} disabled={!audioURL}>
          <PlayArrowIcon /> Play / Pause
        </button>
        <button className="material-button" onClick={saveAudio} disabled={!audioURL}>
          <SaveIcon /> Save
        </button>
        <button className="material-button" onClick={summarizeTranscript} disabled={!transcription}>
          Summarize Transcript
        </button>
      </div>
      <div className="caption-bar" style={{ height: '150px', overflowY: 'auto', border: '1px solid #ccc', padding: '10px' }}>
        <h3>Live Transcription:</h3>
        <p>{transcription}</p>
      </div>
      <div className="summary-bar" style={{ height: '150px', overflowY: 'auto', border: '1px solid #ccc', padding: '10px' }}>
        <h3>Summary:</h3>
        <p>{summary}</p>
      </div>
    </div>
  );
}

export default App;
