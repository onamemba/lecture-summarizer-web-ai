import React, { useState, useRef, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';
import axios from 'axios';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import AudioMotionAnalyzer from 'audiomotion-analyzer';
import CircularProgress from '@mui/material/CircularProgress';
import '@mui/material/styles'; 
import { jsPDF } from "jspdf"; // Add this import at the top
import './App.css'; 

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState('');
  const [transcription, setTranscription] = useState('');
  const [summary, setSummary] = useState('');
  const [showWaveform, setShowWaveform] = useState(false);
  const waveformRef = useRef(null);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const recognitionRef = useRef(null);
  const audioMotionAnalyzerRef = useRef(null);
  const audioContextRef = useRef(null);
  const [isSummarizing, setIsSummarizing] = useState(false);  

  useEffect(() => {
    if (showWaveform && audioURL) {
      if (!waveformRef.current) {
        waveformRef.current = WaveSurfer.create({
          container: '#waveform',
          waveColor: '#3f51b5',
          progressColor: '#303f9f',
          cursorWidth: 2,
          cursorColor: '#000',
          height: 60,  
          responsive: true,
          hideScrollbar: true,
        });
      }
      try {
        waveformRef.current.load(audioURL);
      } catch (error) {
        console.error('Error loading audio:', error);
      }
    }
    return () => {
      if (waveformRef.current) {
        waveformRef.current.destroy();
        waveformRef.current = null;
      }
    };
  }, [showWaveform, audioURL]);

  const startRecording = async () => {
    // Reset transcription when starting a new recording
    setTranscription('');
    setSummary('');  // Clear summary bar
    setIsRecording(true);
    setShowWaveform(false);
    audioChunks.current = [];

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder.current = new MediaRecorder(stream);
    mediaRecorder.current.start();

    mediaRecorder.current.ondataavailable = (event) => {
      audioChunks.current.push(event.data);
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

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
    };

    recognitionRef.current.onend = () => {
      if (isRecording) recognitionRef.current.start();
    };

    recognitionRef.current.start();

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    const source = audioContextRef.current.createMediaStreamSource(stream);

    if (!audioMotionAnalyzerRef.current) {
      audioMotionAnalyzerRef.current = new AudioMotionAnalyzer(document.getElementById('visualizer'), {
        source: source,
        height: 200,
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
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    mediaRecorder.current.stop();
    recognitionRef.current.stop();

    mediaRecorder.current.onstop = () => {
      const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      setAudioURL(audioUrl);
      setShowWaveform(true);
    };

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (audioMotionAnalyzerRef.current) {
      audioMotionAnalyzerRef.current.destroy();
      audioMotionAnalyzerRef.current = null;
    }
  };

  const playAudio = () => {
    if (waveformRef.current) {
      waveformRef.current.playPause();
    }
  };

  // const saveAudio = () => {
  //   const a = document.createElement('a');
  //   a.style.display = 'none';
  //   a.href = audioURL;
  //   a.download = 'recording.wav';
  //   document.body.appendChild(a);
  //   a.click();
  //   document.body.removeChild(a);
  // };


  const saveSummaryAsPDF = () => {
    const doc = new jsPDF();
    doc.text("Summary:", 10, 10);
  
    // Set the starting position for the text
    let verticalPosition = 20;
  
    // Split the summary into sentences and create bullet points
    if (summary) {
      const sentences = summary.split(/(?<=[.!?])\s+/);
      
      sentences.forEach((sentence) => {
        // Split the sentence into manageable chunks based on the max width
        const bulletPoint = `• ${sentence.trim()}`;
        const lines = doc.splitTextToSize(bulletPoint, 190); // 190 is the max width in mm
  
        // Add each line to the PDF
        lines.forEach((line) => {
          doc.text(line, 10, verticalPosition);
          verticalPosition += 10; // Move down for the next line
        });
      });
    } else {
      doc.text("No summary available.", 10, verticalPosition);
    }
  
    doc.save('summary.pdf');
  };

  const summarizeTranscript = async () => {
    if (!transcription) return;
    setIsSummarizing(true);  // Set loading state to true

    // Modify input to encourage bullet points
    const promptText = `Summarize the following in bullet points:\n\n${transcription}`;

    try {
      const response = await axios.post(
        'https://api-inference.huggingface.co/models/facebook/bart-large-cnn',
        { inputs: promptText },
        {
          headers: {
            Authorization: `Bearer ${process.env.REACT_APP_HUGGINGFACE_API_KEY}`,
          },
        }
      );
  
      const summaryText = response.data[0].summary_text;
  
      // Set the summary directly, assuming Hugging Face returns bullet points
      setSummary(summaryText);
    } catch (error) {
      console.error('Error generating summary:', error);
    }finally {
      setIsSummarizing(false);  // Reset loading state
    }
  };

  return (
    <div className="container">
      <h1>Rec·ol·lect</h1>
      <div className="controls">
        <button className="material-button" onClick={startRecording} disabled={isRecording}>
          <MicIcon /> Start Recording
        </button>
        <button className="material-button" onClick={stopRecording} disabled={!isRecording}>
          <StopIcon /> Stop Recording
        </button>
      </div>
      <div className="visualizer-waveform-container">
        <div id="visualizer" className="visualizer"></div>
        {showWaveform && (
          <div id="waveform" className="waveform"></div>
        )}
      </div>
      <div className="control-buttons">
        <button className="material-button" onClick={playAudio} disabled={!audioURL}>
          <PlayArrowIcon /> Play / Pause
        </button>
        <button className="material-button" onClick={saveSummaryAsPDF} disabled={!audioURL}>
          <SaveIcon /> Save
        </button>
        <button className="material-button" onClick={summarizeTranscript} disabled={!transcription}>
        {isSummarizing ? <CircularProgress size={20} color="inherit" /> : 'Summarize Transcript'}
        </button>
      </div>
      <div className="caption-bar">
        <h3>Captions:</h3>
        <p>{transcription}</p>
      </div>
      <div className="summary-bar">
        <h3>Summary:</h3>
        {summary && (
          <ul>
            {summary.split('\n').map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default App;
