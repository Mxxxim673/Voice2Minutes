import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n/config';
import { AuthProvider } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import Layout from './components/Layout/Layout';
import AudioToText from './pages/AudioToText/AudioToText';
import Usage from './pages/Usage/Usage';
import Pricing from './pages/Pricing/Pricing';
import Auth from './pages/Auth/Auth';
import AuthCallback from './pages/AuthCallback/AuthCallback';
import './styles/globals.css';

function App() {
  return (
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <ErrorBoundary>
          <AuthProvider>
            <ErrorBoundary>
              <Router>
                <div className="App">
                  <Routes>
                    {/* Auth routes without layout */}
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    
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
            </ErrorBoundary>
          </AuthProvider>
        </ErrorBoundary>
      </I18nextProvider>
    </ErrorBoundary>
  );
}

export default App;