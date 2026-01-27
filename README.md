# Hotel Contract Processor

A complete system for uploading hotel contracts, extracting data using AI, and generating Excel sheets matching your database schema.

## Project Structure

```
AIhotels/
├── frontend/           # React frontend application
│   ├── public/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── MainPage.js
│   │   │   ├── HotelsUpload.js
│   │   │   └── LifestylePage.js
│   │   ├── App.js
│   │   ├── index.js
│   │   └── index.css
│   └── package.json
├── backend/            # Express.js backend server
│   ├── server.js
│   ├── package.json
│   └── .env.example
└── n8n-workflows/      # n8n workflow JSON file
    └── hotel_contract_processor.json
```

## Features

- **Main Dashboard**: Choose between Hotels and Lifestyle modules
- **File Upload**: Drag & drop or click to upload hotel contracts (PDF, Word, Excel, Images)
- **AI Data Extraction**: Uses OpenAI GPT-4 to extract structured data from contracts
- **Excel Generation**: Creates 8 separate Excel files matching your database tables:
  - hotels
  - hotel_details
  - hotel_room_categories
  - hotel_room_rates
  - hotel_room_types
  - hotel_terms_conditions
  - hotel_room_inventories
  - hotel_room_daily_inventories
- **Download Options**: Download individual files or all files as ZIP

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- OpenAI API key
- (Optional) n8n instance for workflow automation

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file from example:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` and add your OpenAI API key:
   ```
   PORT=3003
   OPENAI_API_KEY=your_openai_api_key_here
   ```

5. Start the server:
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open your browser and go to `http://localhost:3000`

### n8n Workflow Setup (Optional)

If you want to use n8n for workflow automation:

1. Open your n8n instance
2. Go to **Workflows** → **Import from File**
3. Select `n8n-workflows/hotel_contract_processor.json`
4. Configure the OpenAI credentials in the workflow
5. Activate the workflow
6. Update the backend `.env` file with your n8n webhook URL:
   ```
   N8N_WEBHOOK_URL=http://your-n8n-instance/webhook/process-hotel-contract
   ```

## Usage

1. Open the application in your browser
2. Click on **Hotels** button
3. Upload a hotel contract document (PDF, Word, Excel, or Image)
4. Click **Process Contract & Generate Excel Sheets**
5. Wait for the AI to extract data and generate files
6. Download individual Excel files or all files as ZIP

## Database Tables

The system generates Excel files matching these database tables:

### hotels
Main hotel information including name, description, classification, location, etc.

### hotel_details
Additional hotel details like features, accessibility, amenities.

### hotel_room_categories
Room category definitions (e.g., Deluxe Room, Suite, etc.)

### hotel_room_types
Room type variations (Single, Double, Triple, etc.)

### hotel_room_rates
Complete pricing information including:
- Adult and child rates
- Age restrictions
- Meal plans
- Booking periods
- Occupancy limits

### hotel_terms_conditions
Terms and conditions, cancellation policies.

### hotel_room_inventories
Room inventory and allotment information.

### hotel_room_daily_inventories
Daily inventory tracking with allotment, used, and balance.

## API Endpoints

### POST /api/process-contract
Upload and process a hotel contract document.

**Request**: `multipart/form-data` with `document` field

**Response**:
```json
{
  "success": true,
  "sessionId": "1234567890",
  "message": "Contract processed successfully",
  "files": [
    { "name": "hotels_2026-01-21T10-30-00-000Z.xlsx", "rows": 1 },
    ...
  ]
}
```

### GET /api/download/:sessionId/:fileName
Download a specific Excel file.

### GET /api/download-all/:sessionId
Download all generated Excel files as a ZIP archive.

### GET /api/health
Health check endpoint.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Backend server port | 3003 |
| OPENAI_API_KEY | OpenAI API key for data extraction | Required |
| N8N_WEBHOOK_URL | n8n webhook URL (optional) | - |
| OUTPUT_DIR | Directory for generated files | ./output |

## Troubleshooting

### Common Issues

1. **"No file uploaded" error**: Ensure the file is a supported format (PDF, Word, Excel, Image, Text)

2. **OpenAI API error**: Verify your API key is correct and has sufficient credits

3. **CORS error**: Ensure the backend is running on port 3003

4. **Files not downloading**: Check that the session hasn't expired (1-hour limit)

## License

MIT License
