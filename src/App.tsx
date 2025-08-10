import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n/config';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import Layout from './components/Layout/Layout';
import AudioToText from './pages/AudioToText/AudioToText';
import MeetingMinutes from './pages/MeetingMinutes/MeetingMinutes';
import Usage from './pages/Usage/Usage';
import Pricing from './pages/Pricing/Pricing';
import MyPage from './pages/MyPage/MyPage';
import Auth from './pages/Auth/Auth';
import AuthCallback from './pages/AuthCallback/AuthCallback';
import PaymentSuccess from './pages/PaymentSuccess/PaymentSuccess';
import PaymentCancel from './pages/PaymentCancel/PaymentCancel';
import OperatorInfo from './pages/OperatorInfo/OperatorInfo';
import CommercialTransactionAct from './pages/CommercialTransactionAct/CommercialTransactionAct';
import PrivacyPolicy from './pages/PrivacyPolicy/PrivacyPolicy';
import RefundPolicy from './pages/RefundPolicy/RefundPolicy';
import './styles/globals.css';

function App() {
  return (
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <ErrorBoundary>
            <AuthProvider>
              <ErrorBoundary>
              <Router>
                <div className="App">
                  <Routes>
                    {/* Auth routes without layout */}
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    
                    {/* Payment routes without layout */}
                    <Route path="/payment/success" element={<PaymentSuccess />} />
                    <Route path="/payment/cancel" element={<PaymentCancel />} />
                    
                    {/* Main routes with layout */}
                    <Route path="/*" element={
                      <Layout>
                        <Routes>
                          <Route path="/" element={<AudioToText />} />
                          <Route path="/audio-to-text" element={<AudioToText />} />
                          <Route path="/meeting-minutes" element={<MeetingMinutes />} />
                          <Route path="/usage" element={<Usage />} />
                          <Route path="/pricing" element={<Pricing />} />
                          <Route path="/mypage" element={<MyPage />} />
                          <Route path="/operator-info" element={<OperatorInfo />} />
                          <Route path="/commercial-transaction-act" element={<CommercialTransactionAct />} />
                          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                          <Route path="/refund-policy" element={<RefundPolicy />} />
                        </Routes>
                      </Layout>
                    } />
                  </Routes>
                </div>
              </Router>
              </ErrorBoundary>
            </AuthProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </I18nextProvider>
    </ErrorBoundary>
  );
}

export default App;