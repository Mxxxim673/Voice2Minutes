import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './styles/globals.css';

function TestPage() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Test Page</h1>
      <p>If you can see this, the basic React setup is working!</p>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="*" element={<TestPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;