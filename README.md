# Voice2Minutes - Audio to Meeting Minutes Web Application

A modern web application that converts audio recordings to text transcriptions and generates structured meeting minutes using OpenAI's Whisper and GPT-3.5 APIs.

## Features

### 🎤 Audio to Text Conversion
- Upload audio files (MP3, WAV, M4A, FLAC, OGG)
- Real-time microphone recording with waveform visualization
- Support for files up to 100MB with automatic chunking
- Accurate transcription using OpenAI Whisper API

### 📝 Meeting Minutes Generation
- Generate structured meeting minutes from transcriptions
- Standard template with predefined sections
- Custom template creation with editable sections
- GPT-3.5 powered content extraction

### 📄 Export & Copy Features
- Copy transcription/minutes to clipboard
- Export to Word documents (.docx) with proper formatting
- UTF-8 encoding support for international content

### 🌍 Multi-language Support
- 6 languages: English, Chinese, French, Spanish, Arabic, Russian
- UI translation (audio transcription maintains original language)
- RTL support for Arabic

### 🎨 iOS-native Design
- Safari-inspired color scheme
- Clean, minimalist interface
- Responsive design for desktop, tablet, and mobile
- Smooth animations and transitions

### 👤 User Authentication & Management
- Secure user registration and login with Supabase Auth
- Email verification with multi-language support
- PostgreSQL database for user profiles and usage tracking
- Guest mode with 5-minute trial without registration
- Usage quota management and tracking

### 💰 Pricing Page
- One-time purchases: 5, 10, 30, 100 hours
- Subscriptions: Monthly (30h), Annual (360h)  
- Japanese Yen (¥) pricing
- Stripe integration ready

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express + Supabase
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth + Email verification
- **Styling**: CSS Custom Properties + iOS-native design system
- **Routing**: React Router DOM
- **Internationalization**: react-i18next
- **File Handling**: react-dropzone
- **Document Export**: docx + file-saver
- **APIs**: OpenAI Whisper + GPT-3.5 + Supabase REST API

## Setup Instructions

### Prerequisites
- Node.js 18+ 
- npm or yarn
- OpenAI API key
- Supabase account and project

### Installation

1. **Clone and install dependencies**
   ```bash
   cd Voice2Minutes_claude
   npm install
   ```

2. **Environment Configuration**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Configure your .env file with:
   VITE_OPENAI_API_KEY=your_openai_api_key_here
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```

3. **Database Setup**
   ```bash
   # Run database migrations in your Supabase project
   # Execute the SQL files in database/migrations/ in your Supabase SQL editor
   # Run database/seed/001_plans.sql to populate plans
   ```

4. **Start development servers**
   
   **Option A: Start both servers at once**
   ```bash
   npm run start:full
   ```
   
   **Option B: Start servers separately**
   ```bash
   # Terminal 1: Start backend API server
   npm run server
   
   # Terminal 2: Start frontend development server
   npm run dev
   ```
   
   - Backend API: http://localhost:3001
   - Frontend: http://localhost:5173

5. **Open your browser**
   Navigate to http://localhost:5173

### Production Build

```bash
npm run build
npm run preview
```

## Usage Guide

### Audio to Text
1. Go to "Audio to Text" page
2. Either upload an audio file or record directly
3. Click "Start Transcription"
4. Copy text or export to Word when complete

### Meeting Minutes
1. Complete audio transcription first
2. Go to "Meeting Minutes" page
3. Choose standard template or create custom template
4. Click "Start Summary" to generate minutes
5. Edit content if needed
6. Copy or export the final minutes

## API Usage

### OpenAI Whisper API
- Used for audio-to-text transcription
- Supports streaming for large files (>25MB)
- Automatic chunking for files up to 100MB

### OpenAI GPT-3.5 API
- Used for meeting minutes generation
- Template-based content extraction
- Maintains original transcription accuracy

### Supabase API Endpoints
- **Authentication**: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- **User Management**: `GET /api/auth/me`
- **Usage Tracking**: `GET /api/usage/quota`, `POST /api/usage/consume`
- **Email Services**: `POST /api/email/send-verification`, `POST /api/email/send-welcome`
- **Guest Management**: `POST /api/guest/identity`, `POST /api/guest/verify`

## Security Features

- API keys stored in environment variables
- No hardcoded credentials
- Secure HTTPS API calls
- Local processing with cloud AI services
- No permanent data storage

## Browser Compatibility

- Chrome/Chromium 88+
- Firefox 85+
- Safari 14+
- Edge 88+
- Mobile browsers (iOS Safari, Chrome Mobile)

## File Support

### Audio Formats
- MP3 (audio/mpeg)
- WAV (audio/wav)
- M4A (audio/mp4)
- FLAC (audio/flac)
- OGG (audio/ogg)

### Export Formats
- Plain text (clipboard)
- Microsoft Word (.docx)

## Responsive Design

- **Desktop**: Full feature set with optimal layout
- **Tablet**: Touch-friendly interface with adapted controls
- **Mobile**: Streamlined experience with essential features

## Development

### Project Structure
```
src/
├── components/          # Reusable UI components
├── pages/              # Main application pages
├── services/           # API integration services
├── utils/              # Utility functions
├── i18n/               # Internationalization files
├── styles/             # Global styles and themes
└── types/              # TypeScript type definitions
```

### Key Components
- **AudioRecorder**: Real-time recording with waveform
- **TemplateSelector**: Template management for minutes
- **MeetingMinutesEditor**: Editable minutes interface
- **LanguageSelector**: Multi-language switching

### Services
- **audioService**: Whisper API integration with chunking
- **meetingService**: GPT-3.5 integration for minutes
- **exportUtils**: Document generation utilities

## Contributing

1. Follow iOS design guidelines
2. Maintain responsive design principles
3. Add proper TypeScript types
4. Include translations for new features
5. Test across all supported browsers

## License

© 2025 Voice2Minutes. All rights reserved.

## Support

For technical issues or feature requests, please check the browser console for detailed error messages and ensure your OpenAI API key is properly configured.