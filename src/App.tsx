import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n/config';
import Layout from './components/Layout/Layout';
import AudioToText from './pages/AudioToText/AudioToText';
import Pricing from './pages/Pricing/Pricing';
import './styles/globals.css';

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <Router>
        <div className="App">
          <Layout>
            <Routes>
              <Route path="/" element={<AudioToText />} />
              <Route path="/audio-to-text" element={<AudioToText />} />
              <Route path="/pricing" element={<Pricing />} />
            </Routes>
          </Layout>
        </div>
      </Router>
    </I18nextProvider>
  );
}

export default App;