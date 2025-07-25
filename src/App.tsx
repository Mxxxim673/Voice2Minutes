import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n/config';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import AudioToText from './pages/AudioToText/AudioToText';
import Usage from './pages/Usage/Usage';
import Pricing from './pages/Pricing/Pricing';
import Auth from './pages/Auth/Auth';
import './styles/globals.css';

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <Router>
          <div className="App">
            <Routes>
              {/* Auth route without layout */}
              <Route path="/auth" element={<Auth />} />
              
              {/* Main routes with layout */}
              <Route path="/*" element={
                <Layout>
                  <Routes>
                    <Route path="/" element={<AudioToText />} />
                    <Route path="/audio-to-text" element={<AudioToText />} />
                    <Route path="/usage" element={<Usage />} />
                    <Route path="/pricing" element={<Pricing />} />
                  </Routes>
                </Layout>
              } />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </I18nextProvider>
  );
}

export default App;