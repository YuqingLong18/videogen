# Kling AI Video Generator

A modern web interface for generating videos using Kling AI's text-to-video and image-to-video APIs.

## Features

- 🎨 **Modern UI** with dark theme and glassmorphism effects
- ✍️ **Text-to-Video** generation with customizable parameters
- 🖼️ **Image-to-Video** generation with starting and ending frames
- 🎬 **Video playback** with download functionality
- 🔒 **Secure API key** management via environment variables

## Prerequisites

- Node.js (v14 or higher)
- Kling AI API key ([Get one here](https://app.klingai.com))

## Installation

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

3. Configure your API key:
   - Open the `.env` file
   - Replace `your_api_key_here` with your actual Kling AI API key:
   ```
   KLING_API_KEY=your_actual_api_key_here
   PORT=3000
   ```

## Usage

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. **Generate Text-to-Video:**
   - Enter a descriptive prompt
   - Select duration (5s or 10s)
   - Choose aspect ratio (16:9, 9:16, or 1:1)
   - Select model version
   - Click "Generate Video"

4. **Generate Image-to-Video:**
   - Click the "Image to Video" tab
   - Upload a starting frame image
   - Optionally upload an ending frame
   - Add a motion description prompt
   - Configure duration and model
   - Click "Generate Video"

5. **Download Videos:**
   - Once generation completes, the video plays automatically
   - Click the "Download Video" button to save

## Project Structure

```
videogen/
├── index.html          # Frontend HTML structure
├── style.css           # Styling with modern design
├── app.js              # Frontend JavaScript logic
├── server.js           # Backend Express server
├── package.json        # Node.js dependencies
├── .env                # Environment variables (API key)
└── .gitignore          # Git ignore rules
```

## API Endpoints

The backend server provides the following proxy endpoints:

- `POST /api/text2video` - Submit text-to-video generation
- `GET /api/text2video/:taskId` - Check text-to-video status
- `POST /api/image2video` - Submit image-to-video generation
- `GET /api/image2video/:taskId` - Check image-to-video status
- `GET /api/health` - Health check endpoint

## Development

For development with auto-reload:

```bash
npm install -g nodemon
npm run dev
```

## Security Notes

- The `.env` file is excluded from git via `.gitignore`
- Never commit your API key to version control
- The backend server handles all API authentication
- Frontend never exposes the API key

## Troubleshooting

**Server won't start:**
- Make sure port 3000 is not already in use
- Check that Node.js is installed: `node --version`

**API errors:**
- Verify your API key is correct in `.env`
- Check your Kling AI account has sufficient credits
- Review server logs for detailed error messages

**Video generation fails:**
- Ensure your prompt is descriptive and clear
- Check image file sizes (should be reasonable, < 10MB)
- Wait for previous generations to complete before starting new ones

## License

MIT

## Support

For issues with the Kling AI API, visit [Kling AI Documentation](https://app.klingai.com/cn/dev/document-api)
