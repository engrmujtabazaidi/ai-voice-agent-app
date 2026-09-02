# AI Voice Agent Appointment Automation Prototype

## Overview

This is a local development prototype of a web application that demonstrates an AI voice agent system for scheduling appointments for real estate and service businesses. The app includes:

- A React frontend dashboard for managing businesses, agents, appointments, and call logs
- An Express/SQLite backend with a Twilio-compatible webhook interface
- A simulation mode that allows testing the complete call flow without real Twilio integration
- AI voice agent logic that handles multi-turn conversations and appointment booking the appointment and call logs.

## Prerequisites

- Node.js 18.x or higher (tested with Node 22)
- npm 10.x or higher
- Internet connection for initial package installation

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/your-username/ai-voice-agent-app.git
   cd ai-voice-agent-app
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Install additional dependencies:
   ```
   npm install better-sqlite3
   ```

## Environment Setup

Copy the example environment file and edit as needed:

```
cp .env.example .env
```

Edit `.env` to set your configuration. For local simulation mode (the default), the Twilio credentials should remain empty.

## Running the Application

Start both servers simultaneously with:

```
npm run dev
```

This will:
- Start the backend server on port 3001
- Start the Vite frontend development server on port 5173
- Proxy API requests from the frontend to the backend

The application will be available at:
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001

## Local Simulation Mode

The application includes a simulation mode that allows testing the full call flow without connecting real Twilio numbers:

1. Start the servers with `npm run dev`
2. Open http://localhost:5173 in your browser
3. Navigate to the Dashboard page
4. Go to the "Call Logs" page
5. Click the "Simulate Call" button (or similar interface element)
6. Enter a business ID, caller number, and caller name
6. The AI agent will simulate a natural conversation and handle appointment booking

## Features Included in This Prototype

- ✅ React frontend with 5 main pages: Dashboard, Businesses, Voice Agents, Appointments, Call Logs
- ✅ Express backend with SQLite database
- ✅ Twilio-compatible API endpoints
- ✅ Simulation mode for inbound call testing
- ✅ Appointment booking flow with multi-turn conversation
- ✅ Call logging with timestamps and status tracking
- ✅ Responsive design with proper mobile support

## Features Still Mocked (Local Simulation Only)

- Real phone calls (simulated via POST requests)
- Speech-to-text transcription (simulated text input)
- Text-to-speech voice synthesis (simulated via chat interface)
- Real-time call audio streaming
- Integration with actual LLM providers
- User authentication and account management
- Production-grade error handling and monitoring

## Getting Started

1. Install dependencies:
   ```
   npm install
   ```

2. Start the development servers:
   ```
   npm run dev
   ```

3. Open http://localhost:5173 in your browser

4. The dashboard will load automatically. From there, you can:
   - View and manage businesses
   - View and manage AI voice agents
   - View and manage appointments
   - View call logs
   - Test the simulated call flow

## Development Notes

- The backend uses SQLite for persistent storage in development
- Agent schedules are set to 9:00 AM - 7:00 PM Chicago time (America/Chicago timezone)
- The simulation mode uses empty Twilio credentials by default
- The frontend uses Vite for fast development with hot reloading
- The backend uses better-sqlite3 for synchronous database operations

## Future Enhancements (Planned)

- Integration with real Twilio numbers
- Real speech-to-text and text-to-speech capabilities
- Integration with OpenAI or other LLM providers
- User authentication and account management
- Deployment to production environments
- Enhanced UI/UX with animations and transitions
- Performance optimization and caching

## License

This project is provided as-is under the MIT License.