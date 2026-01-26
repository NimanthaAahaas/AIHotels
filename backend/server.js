const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const ExcelJS = require('exceljs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const OpenAI = require('openai');
const axios = require('axios');
const FormData = require('form-data');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// n8n Cloud Webhook URL
const N8N_WEBHOOK_URL = 'https://aahaas-ai.app.n8n.cloud/webhook/process-hotel-contract';

// Database configuration - handle password with special characters
const dbPassword = (process.env.DB_PASSWORD || '&l+>XV7=Q@iF&B9').replace(/^["']|["']$/g, ''); // Remove quotes if present

const DB_CONFIG = {
  host: process.env.DB_HOST || '35.197.143.222',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: dbPassword,
  database: process.env.DB_NAME || 'production_test5',
  connectTimeout: 30000,
  ssl: false
};

// Log DB config (without password) for debugging
console.log('Database config:', { 
  host: DB_CONFIG.host, 
  port: DB_CONFIG.port, 
  user: DB_CONFIG.user, 
  database: DB_CONFIG.database,
  passwordLength: DB_CONFIG.password?.length 
});

// Table mapping: Excel file name -> Database table name
const TABLE_MAPPING = {
  'hotels': 'hotels',
  'hotel_details': 'hotel_details',
  'hotel_room_categories': 'hotel_room_categories',
  'hotel_room_types': 'hotel_room_types',
  'hotel_room_rates': 'hotel_room_rates',
  'hotel_terms_conditions': 'hotel_terms_conditions',
  'hotel_room_inventories': 'hotel_room_inventories',
  'hotel_room_daily_inventories': 'hotel_room_daily_inventories'
};

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Serve lifestyle app static files
const lifestyleDir = path.join(__dirname, 'lifestyle');
app.use('/lifestyle-app', express.static(lifestyleDir));

// Serve lifestyle app for any route under /lifestyle-app (SPA support)
app.get('/lifestyle-app/*', (req, res) => {
  res.sendFile(path.join(lifestyleDir, 'index.html'));
});

// Create directories if they don't exist
const uploadDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'output');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Database table schemas
const tableSchemas = {
  hotels: [
    'id', 'hotel_name', 'hotel_description', 'star_classification', 'auto_confirmation',
    'triggers', 'hotel_classification', 'longitude', 'latitude', 'provider',
    'hotel_address', 'trip_advisor_link', 'hotel_image', 'country', 'city',
    'micro_location', 'hotel_status', 'start_date', 'end_date', 'vendor_id',
    'updated_by', 'created_at', 'updated_at', 'additional_data_1', 'markup',
    'sub_description', 'deleted_at', 'temp_column'
  ],
  hotel_details: [
    'id', 'hotel_id', 'driver_accomadation', 'lift_status', 'vehicle_approchable',
    'ac_status', 'covid_safe', 'feature1', 'feature2', 'feature3', 'feature4',
    'preferred', 'updated_by', 'created_at', 'updated_at', 'hotel_detailscol', 'deleted_at'
  ],
  hotel_room_categories: [
    'id', 'hotel_id', 'room_category_name', 'created_at', 'updated_at', 'deleted_at'
  ],
  hotel_room_rates: [
    'id', 'hotel_id', 'market_nationality', 'currency', 'adult_rate', 'child_with_bed_rate',
    'child_without_bed_rate', 'child_foc_age', 'child_with_no_bed_age', 'child_with_bed_age',
    'adult_age', 'book_by_days', 'meal_plan', 'room_category_id', 'room_type_id',
    'booking_start_date', 'booking_end_date', 'payment_type', 'blackout_dates', 'blackout_days',
    'created_at', 'updated_at', 'card_id', 'deleted_at', 'actual_adult_rate',
    'actual_child_with_bed_rate', 'actual_child_without_bed_rate', 'min_adult_occupancy',
    'max_adult_occupancy', 'min_child_occupancy', 'max_child_occupancy', 'total_occupancy'
  ],
  hotel_room_types: [
    'id', 'hotel_id', 'room_category_type', 'created_at', 'updated_at', 'deleted_at'
  ],
  hotel_terms_conditions: [
    'id', 'hotel_id', 'general_tc', 'cancellation_policy', 'cancellation_deadline',
    'updated_by', 'created_at', 'updated_at', 'deleted_at'
  ],
  hotel_room_inventories: [
    'id', 'rate_id', 'booking_start_date', 'booking_end_date', 'allotment',
    'stop_sale_date', 'created_at', 'updated_at', 'deleted_at'
  ],
  hotel_room_daily_inventories: [
    'id', 'hotel_id', 'inventory_id', 'room_category_id', 'date', 'daily_allotment',
    'used', 'balance', 'created_at', 'updated_at', 'deleted_at'
  ]
};

// Extract text from different file types
async function extractTextFromFile(filePath, mimeType) {
  const fileBuffer = fs.readFileSync(filePath);
  
  if (mimeType === 'application/pdf') {
    const data = await pdfParse(fileBuffer);
    return data.text;
  } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value;
  } else if (mimeType === 'text/plain') {
    return fileBuffer.toString('utf-8');
  } else {
    // For images or unsupported types, return a placeholder
    return 'Document content - manual extraction needed';
  }
}

// Extract data using OpenAI
async function extractDataWithAI(text) {
  const systemPrompt = `You are an expert at extracting structured data from hotel contracts. Extract all relevant information from the provided document text.

IMPORTANT: Extract the ACTUAL data from the document. Do NOT invent or make up data. Use the exact hotel name, rates, dates, and details as they appear in the document.

CRITICAL INSTRUCTION FOR RATES:
The contract may have MULTIPLE DATE PERIODS with DIFFERENT RATES. For example:
- Period 1: 01.05.26 – 30.06.26 with rates 300, 325, 350...
- Period 2: 01.07.26 – 31.08.26 with rates 320, 350, 400...
- Period 3: 01.09.26 – 31.10.26 with rates 300, 325, 350...

You MUST create a SEPARATE rate entry for EACH room category for EACH date period!
If there are 7 room categories and 3 date periods, you should have 21 rate entries (7 × 3).

ALSO CHECK FOR MEAL PLANS:
- Look for meal plan indicators: BB (Bed & Breakfast), HB (Half Board), FB (Full Board), AI (All Inclusive), RO (Room Only)
- If multiple meal plans exist, note them. The system will handle expansion.

Return a JSON object with the following structure:

1. hotels: { 
   hotel_name (exact name from document), 
   hotel_description (actual description), 
   star_classification (number 1-5), 
   auto_confirmation (0 or 1), 
   triggers (0), 
   hotel_classification (Resort/Hotel/Boutique/Villa etc.), 
   longitude (if available, otherwise empty), 
   latitude (if available, otherwise empty), 
   provider (the company/DMC mentioned), 
   hotel_address (full address from document), 
   trip_advisor_link (if mentioned), 
   hotel_image (if URL mentioned), 
   country (2-letter code like LK for Sri Lanka, MV for Maldives), 
   city (city name), 
   micro_location (area/neighborhood), 
   hotel_status (1 for active), 
   start_date (contract validity start in YYYY-MM-DD format), 
   end_date (contract validity end in YYYY-MM-DD format), 
   vendor_id (empty string), 
   additional_data_1 (currency code like USD, LKR), 
   markup (percentage as number without % sign), 
   sub_description (brief tagline or highlights)
}

2. hotel_details: { 
   driver_accomadation (yes/no), 
   lift_status (yes/no), 
   vehicle_approchable (yes/no), 
   ac_status (yes/no), 
   covid_safe (yes/no), 
   feature1-feature4 (amenities like Pool, Spa, Restaurant, WiFi), 
   preferred (yes/no) 
}

3. hotel_room_categories: Array of { room_category_name } - Extract ALL room types like "Deluxe", "Premium Deluxe", "Suite", "Villa", etc. MUST include every room category from the rate table!

4. hotel_room_types: Array of { room_category_type } - Always include "Single" and "Double"

5. hotel_room_rates: Array of objects - CREATE ONE ENTRY FOR EACH ROOM CATEGORY FOR EACH DATE PERIOD!
   Each entry should have: { 
   market_nationality: "All", 
   currency (USD/LKR etc.), 
   adult_rate (number - the rate for this room category in this period), 
   child_with_bed_rate (number, default 80), 
   child_without_bed_rate (number, default 40), 
   child_foc_age: "0-6", 
   child_with_no_bed_age: "6-11.99", 
   child_with_bed_age: "6-11.99", 
   adult_age: "12+", 
   book_by_days (0), 
   meal_plan (BB/HB/FB/AI/RO - use what's in the contract), 
   room_category_id (EXACT room category name from the table), 
   booking_start_date (YYYY-MM-DD - start of THIS period), 
   booking_end_date (YYYY-MM-DD - end of THIS period), 
   payment_type: "Advance"
}

EXAMPLE: If the contract shows:
- Period 1 (01.05.26-30.06.26): Deluxe=300, Premium Deluxe=325, Suite=350
- Period 2 (01.07.26-31.08.26): Deluxe=320, Premium Deluxe=350, Suite=400

You should create 6 rate entries:
[
  {"room_category_id": "Deluxe", "adult_rate": 300, "booking_start_date": "2026-05-01", "booking_end_date": "2026-06-30", "meal_plan": "BB", ...},
  {"room_category_id": "Premium Deluxe", "adult_rate": 325, "booking_start_date": "2026-05-01", "booking_end_date": "2026-06-30", "meal_plan": "BB", ...},
  {"room_category_id": "Suite", "adult_rate": 350, "booking_start_date": "2026-05-01", "booking_end_date": "2026-06-30", "meal_plan": "BB", ...},
  {"room_category_id": "Deluxe", "adult_rate": 320, "booking_start_date": "2026-07-01", "booking_end_date": "2026-08-31", "meal_plan": "BB", ...},
  {"room_category_id": "Premium Deluxe", "adult_rate": 350, "booking_start_date": "2026-07-01", "booking_end_date": "2026-08-31", "meal_plan": "BB", ...},
  {"room_category_id": "Suite", "adult_rate": 400, "booking_start_date": "2026-07-01", "booking_end_date": "2026-08-31", "meal_plan": "BB", ...}
]

6. hotel_terms_conditions: { 
   general_tc (general terms from document), 
   cancellation_policy (cancellation terms), 
   cancellation_deadline (deadline info) 
}

7. hotel_room_inventories: [] (leave empty, will be generated)

8. hotel_room_daily_inventories: [] (leave empty, will be generated)

Return ONLY valid JSON. Extract REAL data from the document - do not make up hotel names or fake data. ALL DATES MUST BE IN YYYY-MM-DD FORMAT.`;

  try {
    console.log('Calling OpenAI API for data extraction...');
    console.log('Text to process (first 500 chars):', text.substring(0, 500));
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Extract hotel contract data from this document:\n\n${text}` }
      ],
      temperature: 0.1,
      max_tokens: 4000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    console.log('OpenAI response received, parsing JSON...');
    const parsed = JSON.parse(content);
    console.log('Extracted hotel name:', parsed.hotels?.hotel_name);
    return parsed;
  } catch (error) {
    console.error('OpenAI extraction error:', error);
    // Return empty structure if AI extraction fails
    return {
      hotels: {},
      hotel_details: {},
      hotel_room_categories: [],
      hotel_room_types: [],
      hotel_room_rates: [],
      hotel_terms_conditions: {},
      hotel_room_inventories: [],
      hotel_room_daily_inventories: []
    };
  }
}

// Expand rates to include all combinations (period × category × room_type × meal_plan)
// card_id starts from 100, same card_id for same category in same period
function expandRates(extractedData) {
  const roomRatesFromAI = extractedData.hotel_room_rates || [];
  const roomCategories = extractedData.hotel_room_categories || [];
  
  if (roomRatesFromAI.length === 0) {
    console.log('No rates from AI to expand');
    return extractedData;
  }

  console.log('Expanding rates. AI returned:', roomRatesFromAI.length, 'rate entries');

  // Extract unique meal plans
  const mealPlansSet = new Set();
  roomRatesFromAI.forEach(rate => {
    if (rate.meal_plan) {
      const plans = String(rate.meal_plan).split(',').map(p => p.trim().toUpperCase());
      plans.forEach(p => mealPlansSet.add(p));
    }
  });
  const mealPlans = mealPlansSet.size > 0 ? Array.from(mealPlansSet) : ['BB'];
  console.log('Meal plans found:', mealPlans);

  // Extract unique date periods
  const datePeriodsMap = new Map();
  roomRatesFromAI.forEach(rate => {
    const key = `${rate.booking_start_date}_${rate.booking_end_date}`;
    if (rate.booking_start_date && rate.booking_end_date && !datePeriodsMap.has(key)) {
      datePeriodsMap.set(key, { start: rate.booking_start_date, end: rate.booking_end_date });
    }
  });
  const datePeriods = Array.from(datePeriodsMap.values());
  console.log('Date periods found:', datePeriods.length);

  // Room types (always Single and Double)
  const roomTypesList = ['Single', 'Double'];

  // Create lookup map for rates
  const ratesLookup = new Map();
  roomRatesFromAI.forEach(rate => {
    const periodKey = `${rate.booking_start_date}_${rate.booking_end_date}`;
    const categoryKey = rate.room_category_id || '';
    const mealPlanKey = (rate.meal_plan || 'BB').toUpperCase();
    const key = `${periodKey}_${categoryKey}_${mealPlanKey}`;
    if (!ratesLookup.has(key)) {
      ratesLookup.set(key, rate);
    }
  });

  // Get category names
  let categoryNames = roomCategories.map(cat => cat.room_category_name).filter(n => n);
  if (categoryNames.length === 0) {
    const catSet = new Set();
    roomRatesFromAI.forEach(rate => {
      if (rate.room_category_id) catSet.add(rate.room_category_id);
    });
    categoryNames = Array.from(catSet);
  }
  console.log('Room categories:', categoryNames.length, categoryNames);

  // Sort periods by start date
  datePeriods.sort((a, b) => a.start.localeCompare(b.start));

  // Generate expanded rates
  const expandedRates = [];
  let cardId = 100; // Starting card_id

  for (const period of datePeriods) {
    for (const mealPlan of mealPlans) {
      for (const category of categoryNames) {
        // Find rate data for this combination
        const lookupKey = `${period.start}_${period.end}_${category}_${mealPlan}`;
        const rateData = ratesLookup.get(lookupKey) || 
          roomRatesFromAI.find(r => 
            r.room_category_id === category && 
            r.booking_start_date === period.start && 
            r.booking_end_date === period.end
          ) || 
          roomRatesFromAI.find(r => r.room_category_id === category) || 
          {};
        
        const currentCardId = cardId;
        
        // Create entry for each room type with SAME card_id
        for (const roomType of roomTypesList) {
          expandedRates.push({
            market_nationality: rateData.market_nationality || 'All',
            currency: rateData.currency || 'USD',
            adult_rate: parseFloat(rateData.adult_rate) || 0,
            child_with_bed_rate: parseFloat(rateData.child_with_bed_rate) || 80,
            child_without_bed_rate: parseFloat(rateData.child_without_bed_rate) || 40,
            child_foc_age: rateData.child_foc_age || '0-6',
            child_with_no_bed_age: rateData.child_with_no_bed_age || '6-11.99',
            child_with_bed_age: rateData.child_with_bed_age || '6-11.99',
            adult_age: rateData.adult_age || '12+',
            book_by_days: parseInt(rateData.book_by_days) || 0,
            meal_plan: mealPlan,
            room_category_id: category,
            room_type_id: roomType,
            booking_start_date: period.start,
            booking_end_date: period.end,
            payment_type: rateData.payment_type || 'Advance',
            blackout_dates: rateData.blackout_dates || '',
            blackout_days: rateData.blackout_days || '',
            card_id: currentCardId,
            actual_adult_rate: parseFloat(rateData.actual_adult_rate) || parseFloat(rateData.adult_rate) || 0,
            actual_child_with_bed_rate: parseFloat(rateData.actual_child_with_bed_rate) || parseFloat(rateData.child_with_bed_rate) || 80,
            actual_child_without_bed_rate: parseFloat(rateData.actual_child_without_bed_rate) || parseFloat(rateData.child_without_bed_rate) || 40,
            min_adult_occupancy: parseInt(rateData.min_adult_occupancy) || 1,
            max_adult_occupancy: parseInt(rateData.max_adult_occupancy) || 2,
            min_child_occupancy: parseInt(rateData.min_child_occupancy) || 0,
            max_child_occupancy: parseInt(rateData.max_child_occupancy) || 2,
            total_occupancy: parseInt(rateData.total_occupancy) || 3
          });
        }
        
        cardId++; // Increment for next category
      }
    }
  }

  console.log('Expanded rates generated:', expandedRates.length, 'entries');
  
  // Update extracted data with expanded rates
  extractedData.hotel_room_rates = expandedRates;
  
  // Generate room inventories based on expanded rates
  extractedData.hotel_room_inventories = expandedRates.map(rate => ({
    booking_start_date: rate.booking_start_date,
    booking_end_date: rate.booking_end_date,
    allotment: 10,
    stop_sale_date: ''
  }));

  return extractedData;
}

// Create Excel files from extracted data
async function createExcelFiles(extractedData, sessionId) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sessionDir = path.join(outputDir, sessionId);
  
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const createdFiles = [];
  const currentTimestamp = new Date().toISOString();

  // Process each table
  for (const [tableName, columns] of Object.entries(tableSchemas)) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(tableName);

    // Add header row
    worksheet.addRow(columns);
    
    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Get data for this table
    let tableData = [];
    
    if (tableName === 'hotels' && extractedData.hotels) {
      tableData = [extractedData.hotels];
    } else if (tableName === 'hotel_details' && extractedData.hotel_details) {
      tableData = [extractedData.hotel_details];
    } else if (tableName === 'hotel_room_categories' && extractedData.hotel_room_categories) {
      tableData = extractedData.hotel_room_categories;
    } else if (tableName === 'hotel_room_types' && extractedData.hotel_room_types) {
      tableData = extractedData.hotel_room_types;
    } else if (tableName === 'hotel_room_rates' && extractedData.hotel_room_rates) {
      tableData = extractedData.hotel_room_rates;
    } else if (tableName === 'hotel_terms_conditions' && extractedData.hotel_terms_conditions) {
      tableData = [extractedData.hotel_terms_conditions];
    } else if (tableName === 'hotel_room_inventories' && extractedData.hotel_room_inventories) {
      tableData = extractedData.hotel_room_inventories;
    } else if (tableName === 'hotel_room_daily_inventories' && extractedData.hotel_room_daily_inventories) {
      tableData = extractedData.hotel_room_daily_inventories;
    }

    // Add data rows
    if (tableData.length > 0) {
      tableData.forEach((item, index) => {
        const rowData = columns.map(col => {
          if (col === 'id') return '';
          if (col === 'hotel_id') return '';
          if (col === 'created_at' || col === 'updated_at') return currentTimestamp;
          if (col === 'deleted_at') return '';
          return item[col] !== undefined ? item[col] : '';
        });
        worksheet.addRow(rowData);
      });
    } else {
      // Add empty row with timestamps
      const emptyRow = columns.map(col => {
        if (col === 'created_at' || col === 'updated_at') return currentTimestamp;
        return '';
      });
      worksheet.addRow(emptyRow);
    }

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.min(maxLength + 2, 50);
    });

    // Save workbook
    const fileName = `${tableName}_${timestamp}.xlsx`;
    const filePath = path.join(sessionDir, fileName);
    await workbook.xlsx.writeFile(filePath);
    
    createdFiles.push({
      name: fileName,
      rows: tableData.length > 0 ? tableData.length : 1,
      path: filePath
    });
  }

  return createdFiles;
}

// Store session data
const sessions = new Map();

// Process contract endpoint
app.post('/api/process-contract', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    console.log('Processing file:', req.file.originalname);
    
    // Generate session ID
    const sessionId = Date.now().toString();
    
    // Extract text from document
    const extractedText = await extractTextFromFile(req.file.path, req.file.mimetype);
    console.log('Extracted text length:', extractedText.length);

    // Extract structured data using AI
    let extractedData = await extractDataWithAI(extractedText);
    console.log('Data extracted successfully');
    console.log('AI extracted rates count:', extractedData.hotel_room_rates?.length || 0);

    // Expand rates to all combinations (period × category × room_type × meal_plan)
    extractedData = expandRates(extractedData);
    console.log('Final expanded rates count:', extractedData.hotel_room_rates?.length || 0);

    // Create Excel files
    const files = await createExcelFiles(extractedData, sessionId);
    console.log('Excel files created:', files.length);

    // Store session data
    sessions.set(sessionId, {
      files: files,
      createdAt: new Date()
    });

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      sessionId: sessionId,
      message: 'Contract processed successfully',
      files: files.map(f => ({ name: f.name, rows: f.rows }))
    });

  } catch (error) {
    console.error('Error processing contract:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to process contract: ' + error.message 
    });
  }
});

// Download single file endpoint
app.get('/api/download/:sessionId/:fileName', (req, res) => {
  try {
    const { sessionId, fileName } = req.params;
    const filePath = path.join(outputDir, sessionId, fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    res.download(filePath, fileName);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ message: 'Failed to download file' });
  }
});

// Download all files as ZIP endpoint
app.get('/api/download-all/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionDir = path.join(outputDir, sessionId);
    
    if (!fs.existsSync(sessionDir)) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=hotel_contract_data.zip');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    archive.directory(sessionDir, false);
    archive.finalize();

  } catch (error) {
    console.error('Error creating zip:', error);
    res.status(500).json({ message: 'Failed to create zip file' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Clean up old sessions (older than 1 hour)
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [sessionId, data] of sessions) {
    if (data.createdAt < oneHourAgo) {
      const sessionDir = path.join(outputDir, sessionId);
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true });
      }
      sessions.delete(sessionId);
    }
  }
}, 15 * 60 * 1000); // Run every 15 minutes

// Proxy endpoint for n8n webhook (bypasses CORS issues)
app.post('/api/proxy-n8n', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    console.log('Proxying file to n8n:', req.file.originalname);

    // Create form data to send to n8n
    const formData = new FormData();
    formData.append('file', fs.createReadStream(req.file.path), {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    // Forward to n8n webhook
    const n8nResponse = await axios.post(N8N_WEBHOOK_URL, formData, {
      headers: {
        ...formData.getHeaders()
      },
      timeout: 180000, // 3 minute timeout for AI processing
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    console.log('n8n full response status:', n8nResponse.status);
    console.log('n8n response data type:', typeof n8nResponse.data);
    console.log('n8n response data keys:', Object.keys(n8nResponse.data || {}));
    console.log('n8n response received:', n8nResponse.data?.success);
    
    // If n8n returned empty or invalid data, log more details
    if (!n8nResponse.data || !n8nResponse.data.success) {
      console.log('n8n FULL response data:', JSON.stringify(n8nResponse.data, null, 2).substring(0, 2000));
    }
    
    // Log extracted hotel name for debugging
    if (n8nResponse.data?.files?.hotels) {
      console.log('Extracted hotel data preview - check if this matches your contract:');
      const hotelFile = n8nResponse.data.files.hotels;
      // Try to decode and show first few rows
      try {
        const workbook = new ExcelJS.Workbook();
        const buffer = Buffer.from(hotelFile.data, 'base64');
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.getWorksheet(1);
        const rows = [];
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber <= 3) { // Just first 3 rows (header + 2 data)
            rows.push(row.values);
          }
        });
        console.log('Hotels Excel preview:', JSON.stringify(rows, null, 2));
      } catch (e) {
        console.log('Could not preview hotels data');
      }
    }
    
    res.json(n8nResponse.data);

  } catch (error) {
    console.error('Error proxying to n8n:', error.message);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    if (error.response) {
      res.status(error.response.status).json({
        success: false,
        message: error.response.data?.message || 'n8n workflow error',
        error: error.response.data
      });
    } else if (error.code === 'ECONNREFUSED') {
      res.status(503).json({
        success: false,
        message: 'n8n webhook is not available. Make sure the workflow is active.'
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to process document'
      });
    }
  }
});

// Direct processing endpoint - processes locally with OpenAI (bypasses n8n)
// STEP 1: Only generate hotels sheet
app.post('/api/process-direct', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    console.log('Processing file directly with OpenAI:', req.file.originalname);

    // Extract text from the document
    const extractedText = await extractTextFromFile(req.file.path, req.file.mimetype);
    console.log('Extracted text length:', extractedText.length);
    
    if (extractedText.length < 50) {
      throw new Error('Could not extract sufficient text from the document');
    }

    // Extract structured data using OpenAI
    const extractedData = await extractDataWithAI(extractedText);
    console.log('Data extracted. Hotel name:', extractedData.hotels?.hotel_name);

    // Store the extracted data in a temporary file for later steps
    const sessionId = Date.now().toString();
    const sessionDir = path.join(outputDir, sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(path.join(sessionDir, 'extracted_data.json'), JSON.stringify(extractedData, null, 2));

    // Generate Excel files as base64
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const files = {};
    
    // Helper to create Excel buffer
    async function createExcelBuffer(sheetName, headers, data) {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sheet');
      
      // Add headers
      worksheet.addRow(headers);
      
      // Add data rows
      if (Array.isArray(data)) {
        data.forEach(row => {
          const rowData = headers.map(h => row[h] !== undefined ? row[h] : '');
          worksheet.addRow(rowData);
        });
      } else if (data && typeof data === 'object') {
        const rowData = headers.map(h => data[h] !== undefined ? data[h] : '');
        worksheet.addRow(rowData);
      }
      
      const buffer = await workbook.xlsx.writeBuffer();
      return buffer.toString('base64');
    }
    
    // STEP 1: Create ONLY hotels table first
    const hotelsHeaders = tableSchemas.hotels;
    const hotelsData = {
      ...extractedData.hotels,
      auto_confirmation: extractedData.hotels?.auto_confirmation || 1,
      triggers: 0,
      hotel_status: 1,
      created_at: now,
      updated_at: now
    };
    files.hotels = {
      name: 'hotels.xlsx',
      data: await createExcelBuffer('hotels', hotelsHeaders, hotelsData),
      rows: 1
    };
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    console.log('Step 1 complete - Hotels sheet generated. Hotel:', extractedData.hotels?.hotel_name);
    
    res.json({
      success: true,
      message: 'Step 1: Hotels sheet generated. Upload to database to proceed.',
      sessionId: sessionId,
      currentStep: 1,
      files: files
    });

  } catch (error) {
    console.error('Error in direct processing:', error.message);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process document'
    });
  }
});

// STEP 2: Generate dependent sheets after hotels is uploaded
// Creates: hotel_details, hotel_room_categories, hotel_room_types, hotel_room_rates, hotel_terms_conditions
app.post('/api/generate-step2-sheets', express.json({ limit: '50mb' }), async (req, res) => {
  const { sessionId, hotelId } = req.body;
  
  if (!sessionId || !hotelId) {
    return res.status(400).json({ success: false, message: 'sessionId and hotelId are required' });
  }
  
  try {
    console.log(`Step 2: Generating sheets for hotel_id: ${hotelId}`);
    
    // Load extracted data from session
    const sessionDir = path.join(outputDir, sessionId);
    const extractedDataPath = path.join(sessionDir, 'extracted_data.json');
    
    if (!fs.existsSync(extractedDataPath)) {
      throw new Error('Session data not found. Please start over.');
    }
    
    const extractedData = JSON.parse(fs.readFileSync(extractedDataPath, 'utf8'));
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const files = {};
    
    // Helper to create Excel buffer
    async function createExcelBuffer(sheetName, headers, data) {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sheet');
      worksheet.addRow(headers);
      
      if (Array.isArray(data)) {
        data.forEach(row => {
          const rowData = headers.map(h => row[h] !== undefined ? row[h] : '');
          worksheet.addRow(rowData);
        });
      } else if (data && typeof data === 'object') {
        const rowData = headers.map(h => data[h] !== undefined ? data[h] : '');
        worksheet.addRow(rowData);
      }
      
      const buffer = await workbook.xlsx.writeBuffer();
      return buffer.toString('base64');
    }
    
    // Create hotel_details with hotel_id
    const detailsHeaders = tableSchemas.hotel_details;
    const detailsData = {
      ...extractedData.hotel_details,
      hotel_id: hotelId,
      created_at: now,
      updated_at: now
    };
    files.hotel_details = {
      name: 'hotel_details.xlsx',
      data: await createExcelBuffer('hotel_details', detailsHeaders, detailsData),
      rows: 1
    };
    
    // Create hotel_room_categories with hotel_id
    const categoriesHeaders = tableSchemas.hotel_room_categories;
    const categoriesData = (extractedData.hotel_room_categories || []).map(cat => ({
      ...cat,
      hotel_id: hotelId,
      created_at: now,
      updated_at: now
    }));
    files.hotel_room_categories = {
      name: 'hotel_room_categories.xlsx',
      data: await createExcelBuffer('hotel_room_categories', categoriesHeaders, 
        categoriesData.length > 0 ? categoriesData : [{ hotel_id: hotelId, room_category_name: 'Standard', created_at: now, updated_at: now }]),
      rows: categoriesData.length || 1
    };
    
    // Create hotel_room_types with hotel_id
    const typesHeaders = tableSchemas.hotel_room_types;
    const typesData = (extractedData.hotel_room_types || []).map(type => ({
      ...type,
      hotel_id: hotelId,
      created_at: now,
      updated_at: now
    }));
    files.hotel_room_types = {
      name: 'hotel_room_types.xlsx',
      data: await createExcelBuffer('hotel_room_types', typesHeaders, 
        typesData.length > 0 ? typesData : [{ hotel_id: hotelId, room_category_type: 'Standard Room', created_at: now, updated_at: now }]),
      rows: typesData.length || 1
    };
    
    // EXPAND RATES: Create all combinations of period × category × room_type × meal_plan
    const expandedData = expandRates(extractedData);
    
    // Create hotel_room_rates with hotel_id (room_category_id will be added later)
    const ratesHeaders = tableSchemas.hotel_room_rates;
    const ratesData = (expandedData.hotel_room_rates || []).map((rate) => ({
      ...rate,
      hotel_id: hotelId,
      created_at: now,
      updated_at: now
    }));
    files.hotel_room_rates = {
      name: 'hotel_room_rates.xlsx',
      data: await createExcelBuffer('hotel_room_rates', ratesHeaders, 
        ratesData.length > 0 ? ratesData : [{ hotel_id: hotelId, created_at: now, updated_at: now }]),
      rows: ratesData.length || 1
    };
    
    console.log(`Generated ${ratesData.length} room rate rows (expanded from AI data)`);
    
    // Create hotel_terms_conditions with hotel_id
    const termsHeaders = tableSchemas.hotel_terms_conditions;
    const termsData = {
      ...extractedData.hotel_terms_conditions,
      hotel_id: hotelId,
      created_at: now,
      updated_at: now
    };
    files.hotel_terms_conditions = {
      name: 'hotel_terms_conditions.xlsx',
      data: await createExcelBuffer('hotel_terms_conditions', termsHeaders, termsData),
      rows: 1
    };
    
    // Save hotelId for later steps
    fs.writeFileSync(path.join(sessionDir, 'hotel_id.txt'), hotelId.toString());
    
    console.log('Step 2 complete - Generated 5 sheets with hotel_id:', hotelId);
    
    res.json({
      success: true,
      message: 'Step 2: Generated hotel_details, hotel_room_categories, hotel_room_types, hotel_room_rates, hotel_terms_conditions sheets.',
      currentStep: 2,
      hotelId: hotelId,
      files: files
    });
    
  } catch (error) {
    console.error('Error generating step 2 sheets:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate step 2 sheets'
    });
  }
});

// STEP 3: Generate hotel_room_inventories after hotel_room_rates is uploaded
app.post('/api/generate-step3-sheets', express.json({ limit: '50mb' }), async (req, res) => {
  const { sessionId, hotelId } = req.body;
  
  if (!sessionId || !hotelId) {
    return res.status(400).json({ success: false, message: 'sessionId and hotelId are required' });
  }
  
  let connection;
  
  try {
    console.log(`Step 3: Generating hotel_room_inventories for hotel_id: ${hotelId}`);
    
    // Connect to database and fetch rate_ids from hotel_room_rates
    connection = await mysql.createConnection(DB_CONFIG);
    
    // Fetch rates with their room_category_id
    const [rates] = await connection.execute(
      'SELECT id as rate_id, hotel_id, room_category_id, booking_start_date, booking_end_date FROM hotel_room_rates WHERE hotel_id = ?',
      [hotelId]
    );
    
    console.log(`Found ${rates.length} rate records for hotel_id: ${hotelId}`);
    console.log('Rates data:', JSON.stringify(rates, null, 2));
    
    // Also fetch room_category_ids for reference
    const [categories] = await connection.execute(
      'SELECT id as room_category_id, hotel_id, room_category_name FROM hotel_room_categories WHERE hotel_id = ?',
      [hotelId]
    );
    
    console.log(`Found ${categories.length} room categories for hotel_id: ${hotelId}`);
    
    await connection.end();
    
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const files = {};
    
    // Helper to create Excel buffer
    async function createExcelBuffer(sheetName, headers, data) {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sheet');
      worksheet.addRow(headers);
      
      if (Array.isArray(data)) {
        data.forEach(row => {
          const rowData = headers.map(h => row[h] !== undefined ? row[h] : '');
          worksheet.addRow(rowData);
        });
      } else if (data && typeof data === 'object') {
        const rowData = headers.map(h => data[h] !== undefined ? data[h] : '');
        worksheet.addRow(rowData);
      }
      
      const buffer = await workbook.xlsx.writeBuffer();
      return buffer.toString('base64');
    }
    
    // Create hotel_room_inventories with rate_id from hotel_room_rates table
    const invHeaders = tableSchemas.hotel_room_inventories;
    const invData = rates.map(rate => {
      const startDate = rate.booking_start_date ? new Date(rate.booking_start_date).toISOString().slice(0, 10) : '';
      const endDate = rate.booking_end_date ? new Date(rate.booking_end_date).toISOString().slice(0, 10) : '';
      
      return {
        rate_id: rate.rate_id,  // This is the id from hotel_room_rates table
        booking_start_date: startDate,
        booking_end_date: endDate,
        allotment: 10,
        stop_sale_date: '',
        created_at: now,
        updated_at: now
      };
    });
    
    console.log('Generated inventory data:', JSON.stringify(invData, null, 2));
    
    files.hotel_room_inventories = {
      name: 'hotel_room_inventories.xlsx',
      data: await createExcelBuffer('hotel_room_inventories', invHeaders, 
        invData.length > 0 ? invData : [{ rate_id: '', allotment: 10, created_at: now, updated_at: now }]),
      rows: invData.length || 1
    };
    
    // Save session data for step 4
    const sessionDir = path.join(outputDir, sessionId);
    fs.writeFileSync(path.join(sessionDir, 'categories.json'), JSON.stringify(categories));
    fs.writeFileSync(path.join(sessionDir, 'rates.json'), JSON.stringify(rates));
    
    console.log('Step 3 complete - Generated hotel_room_inventories with rate_ids');
    
    res.json({
      success: true,
      message: `Step 3: Generated hotel_room_inventories sheet with ${rates.length} rate_ids from database.`,
      currentStep: 3,
      hotelId: hotelId,
      ratesCount: rates.length,
      files: files
    });
    
  } catch (error) {
    console.error('Error generating step 3 sheets:', error.message);
    if (connection) {
      try { await connection.end(); } catch (e) {}
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate step 3 sheets'
    });
  }
});

// STEP 4: Generate hotel_room_daily_inventories after hotel_room_inventories is uploaded
app.post('/api/generate-step4-sheets', express.json({ limit: '50mb' }), async (req, res) => {
  const { sessionId, hotelId } = req.body;
  
  if (!sessionId || !hotelId) {
    return res.status(400).json({ success: false, message: 'sessionId and hotelId are required' });
  }
  
  let connection;
  
  try {
    console.log(`Step 4: Generating hotel_room_daily_inventories for hotel_id: ${hotelId}`);
    
    // Connect to database and fetch room_category_ids (actual IDs, not names)
    connection = await mysql.createConnection(DB_CONFIG);
    
    // Fetch room categories for this hotel - these have the ACTUAL IDs
    const [categories] = await connection.execute(
      'SELECT id, hotel_id, room_category_name FROM hotel_room_categories WHERE hotel_id = ?',
      [hotelId]
    );
    
    // Fetch rates to get booking dates and category info
    const [rates] = await connection.execute(
      'SELECT id, hotel_id, room_category_id, booking_start_date, booking_end_date FROM hotel_room_rates WHERE hotel_id = ?',
      [hotelId]
    );
    
    console.log(`Found ${categories.length} categories and ${rates.length} rates for hotel_id: ${hotelId}`);
    console.log('Categories from DB:', JSON.stringify(categories, null, 2));
    console.log('Rates from DB:', JSON.stringify(rates, null, 2));
    
    // Create a map of category name -> category ID for lookup
    const categoryNameToId = {};
    for (const cat of categories) {
      categoryNameToId[cat.room_category_name] = cat.id;
      // Also map lowercase for case-insensitive matching
      categoryNameToId[cat.room_category_name.toLowerCase()] = cat.id;
    }
    console.log('Category name to ID map:', categoryNameToId);
    
    await connection.end();
    
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const files = {};
    
    // Helper to create Excel buffer
    async function createExcelBuffer(sheetName, headers, data) {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sheet');
      worksheet.addRow(headers);
      
      if (Array.isArray(data)) {
        data.forEach(row => {
          const rowData = headers.map(h => row[h] !== undefined ? row[h] : '');
          worksheet.addRow(rowData);
        });
      } else if (data && typeof data === 'object') {
        const rowData = headers.map(h => data[h] !== undefined ? data[h] : '');
        worksheet.addRow(rowData);
      }
      
      const buffer = await workbook.xlsx.writeBuffer();
      return buffer.toString('base64');
    }
    
    // Create hotel_room_daily_inventories
    // - hotel_id: from the uploaded hotel
    // - inventory_id: set to 0 (user says no need to fetch)
    // - room_category_id: display room category NAME for readability
    const dailyHeaders = tableSchemas.hotel_room_daily_inventories;
    const dailyData = [];
    
    // Generate daily entries for each rate's date range and each category
    for (const rate of rates) {
      // Get the room category name for display
      let categoryName = '';
      
      if (rate.room_category_id) {
        // Check if it's already a number (ID from database)
        if (!isNaN(parseInt(rate.room_category_id))) {
          // Look up the name from the ID
          const catId = parseInt(rate.room_category_id);
          const foundCat = categories.find(c => c.id === catId || c.room_category_id === catId);
          categoryName = foundCat ? foundCat.room_category_name : rate.room_category_id;
        } else {
          // It's already a name
          categoryName = rate.room_category_id;
        }
      }
      
      // Fallback to first category name if no match
      if (!categoryName && categories.length > 0) {
        categoryName = categories[0].room_category_name;
      }
      
      const startDate = rate.booking_start_date ? new Date(rate.booking_start_date) : new Date();
      const endDate = rate.booking_end_date ? new Date(rate.booking_end_date) : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      // Generate daily entries for the date range
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        dailyData.push({
          hotel_id: parseInt(hotelId),
          inventory_id: 0,  // User says no need to fetch this
          room_category_id: categoryName,  // Room category NAME for display
          date: currentDate.toISOString().slice(0, 10),
          daily_allotment: 10,
          used: 0,
          balance: 10,
          created_at: now,
          updated_at: now
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
    
    // If no rates found, create entries for each category
    if (dailyData.length === 0 && categories.length > 0) {
      for (const cat of categories) {
        dailyData.push({
          hotel_id: parseInt(hotelId),
          inventory_id: 0,
          room_category_id: cat.room_category_name,  // Room category NAME for display
          date: new Date().toISOString().slice(0, 10),
          daily_allotment: 10,
          used: 0,
          balance: 10,
          created_at: now,
          updated_at: now
        });
      }
    }
    
    console.log(`Generated ${dailyData.length} daily inventory entries`);
    if (dailyData.length > 0) {
      console.log('Sample daily data:', JSON.stringify(dailyData.slice(0, 3), null, 2));
    }
    
    files.hotel_room_daily_inventories = {
      name: 'hotel_room_daily_inventories.xlsx',
      data: await createExcelBuffer('hotel_room_daily_inventories', dailyHeaders, 
        dailyData.length > 0 ? dailyData : [{ hotel_id: parseInt(hotelId), inventory_id: 0, daily_allotment: 10, used: 0, balance: 10, created_at: now, updated_at: now }]),
      rows: dailyData.length || 1
    };
    
    console.log('Step 4 complete - Generated hotel_room_daily_inventories with actual room_category_id values');
    
    res.json({
      success: true,
      message: `Step 4: Generated ${dailyData.length} daily inventory entries for hotel_id: ${hotelId} with ${categories.length} room categories.`,
      currentStep: 4,
      hotelId: hotelId,
      categoriesCount: categories.length,
      entriesCount: dailyData.length,
      files: files
    });
    
  } catch (error) {
    console.error('Error generating step 4 sheets:', error.message);
    if (connection) {
      try { await connection.end(); } catch (e) {}
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate step 4 sheets'
    });
  }
});

// Helper endpoint to get the last inserted hotel ID
app.get('/api/get-last-hotel-id', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    const [rows] = await connection.execute('SELECT id FROM hotels ORDER BY id DESC LIMIT 1');
    await connection.end();
    
    if (rows.length > 0) {
      res.json({ success: true, hotelId: rows[0].id });
    } else {
      res.json({ success: false, message: 'No hotels found' });
    }
  } catch (error) {
    if (connection) {
      try { await connection.end(); } catch (e) {}
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper function to convert base64 Excel to JSON data
async function parseExcelFromBase64(base64Data) {
  const buffer = Buffer.from(base64Data, 'base64');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  const worksheet = workbook.worksheets[0];
  const rows = [];
  const headers = [];
  
  // Get the number of columns from the header row
  const headerRow = worksheet.getRow(1);
  const columnCount = headerRow.cellCount;
  
  // Parse headers - use getCell to get ALL columns including empty ones
  for (let col = 1; col <= columnCount; col++) {
    const cell = headerRow.getCell(col);
    headers[col - 1] = cell.value?.toString() || `column_${col}`;
  }
  
  console.log(`Parsed headers (${headers.length}):`, headers);
  
  // Parse data rows
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      const rowData = {};
      // Use getCell to get ALL cells including empty ones
      for (let col = 1; col <= columnCount; col++) {
        const header = headers[col - 1];
        if (header) {
          const cell = row.getCell(col);
          let value = cell.value;
          
          // Handle different cell types
          if (value === null || value === undefined) {
            // Keep empty as empty string for now
            rowData[header] = '';
          } else if (value instanceof Date) {
            value = value.toISOString().slice(0, 19).replace('T', ' ');
            rowData[header] = value;
          } else if (typeof value === 'object' && value !== null) {
            value = value.result || value.text || JSON.stringify(value);
            rowData[header] = value;
          } else {
            rowData[header] = value;
          }
        }
      }
      if (Object.keys(rowData).length > 0) {
        rows.push(rowData);
      }
    }
  });
  
  console.log(`Parsed ${rows.length} data rows`);
  if (rows.length > 0) {
    console.log('First row data:', JSON.stringify(rows[0], null, 2));
  }
  
  return rows;
}

// Helper function to insert data into MySQL table
async function insertIntoTable(connection, tableName, data) {
  if (!data || data.length === 0) {
    return { inserted: 0, total: 0, message: 'No data to insert' };
  }
  
  // Columns that should be integers (and should be null if not numeric)
  const integerColumns = ['vendor_id', 'hotel_status', 'auto_confirmation', 'triggers', 'star_classification'];
  
  // Columns that should be decimals (strip non-numeric chars like %)
  const decimalColumns = ['markup', 'adult_rate', 'child_with_bed_rate', 'child_without_bed_rate', 
                          'actual_adult_rate', 'actual_child_with_bed_rate', 'actual_child_without_bed_rate',
                          'longitude', 'latitude'];
  
  // Columns that are NOT NULL and need default values
  const notNullDefaults = {
    'hotel_address': 'Address not specified',
    'hotel_image': 'https://via.placeholder.com/400x300?text=Hotel+Image',
    'description': 'No description available',
    'terms_conditions': 'No terms and conditions specified',
    'room_category_name': 'Standard',
    'room_category_type': 'Standard Room'
  };
  
  // Get column names from the first row, exclude id and empty columns
  const columns = Object.keys(data[0]).filter(col => col !== 'id' && col !== '' && col !== 'deleted_at' && col !== 'temp_column' && col !== 'updated_by');
  
  if (columns.length === 0) {
    return { inserted: 0, total: 0, message: 'No valid columns found' };
  }
  
  // Prepare the INSERT statement
  const placeholders = columns.map(() => '?').join(', ');
  const columnNames = columns.map(col => `\`${col}\``).join(', ');
  const sql = `INSERT INTO \`${tableName}\` (${columnNames}) VALUES (${placeholders})`;
  
  let insertedCount = 0;
  const errors = [];
  
  console.log(`Attempting to insert into ${tableName} with columns:`, columns);
  console.log('SQL:', sql);
  
  for (const row of data) {
    try {
      const values = columns.map(col => {
        let val = row[col];
        
        // Check if value is empty/null
        if (val === '' || val === undefined || val === null) {
          // Use default value if column is NOT NULL, otherwise return null
          if (notNullDefaults[col]) {
            console.log(`Using default value for ${col}: "${notNullDefaults[col]}"`);
            return notNullDefaults[col];
          }
          return null;
        }
        
        // Handle integer columns - if value is not a valid integer, set to null
        if (integerColumns.includes(col)) {
          const intVal = parseInt(val, 10);
          if (isNaN(intVal)) {
            console.log(`Converting non-numeric ${col} value "${val}" to null`);
            return null;
          }
          return intVal;
        }
        
        // Handle decimal columns - strip non-numeric chars (like % sign)
        if (decimalColumns.includes(col)) {
          // Remove any non-numeric chars except . and -
          const cleanVal = String(val).replace(/[^0-9.\-]/g, '');
          const decVal = parseFloat(cleanVal);
          if (isNaN(decVal)) {
            console.log(`Converting non-numeric ${col} value "${val}" to null`);
            return null;
          }
          return decVal;
        }
        
        return val;
      });
      
      await connection.execute(sql, values);
      insertedCount++;
      console.log(`Successfully inserted row ${insertedCount}`);
    } catch (err) {
      console.error(`Insert error for ${tableName}:`, err.message);
      errors.push(`Row error: ${err.message}`);
    }
  }
  
  return { 
    inserted: insertedCount, 
    total: data.length,
    errors: errors.length > 0 ? errors.slice(0, 5) : undefined // Only return first 5 errors
  };
}

// Endpoint to upload Excel data to database
app.post('/api/upload-to-database', express.json({ limit: '50mb' }), async (req, res) => {
  const { files } = req.body;
  
  if (!files || Object.keys(files).length === 0) {
    return res.status(400).json({ success: false, message: 'No files provided' });
  }
  
  let connection;
  const results = {};
  const uploadOrder = [
    'hotels',
    'hotel_details', 
    'hotel_room_categories',
    'hotel_room_types',
    'hotel_room_rates',
    'hotel_terms_conditions',
    'hotel_room_inventories',
    'hotel_room_daily_inventories'
  ];
  
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('Connected to database successfully');
    
    // Process files in the correct order (due to foreign key relationships)
    for (const fileKey of uploadOrder) {
      if (files[fileKey]) {
        const tableName = TABLE_MAPPING[fileKey];
        console.log(`Processing ${fileKey} -> ${tableName}...`);
        
        try {
          // Parse Excel from base64 - support both formats: direct base64 string or object with data property
          const fileEntry = files[fileKey];
          const base64Data = typeof fileEntry === 'string' ? fileEntry : fileEntry.data;
          const data = await parseExcelFromBase64(base64Data);
          console.log(`  Parsed ${data.length} rows from ${fileKey}`);
          
          // Insert into database
          const result = await insertIntoTable(connection, tableName, data);
          results[fileKey] = {
            success: true,
            tableName,
            ...result
          };
          console.log(`  Inserted ${result.inserted}/${result.total} rows into ${tableName}`);
        } catch (err) {
          console.error(`  Error processing ${fileKey}:`, err.message);
          results[fileKey] = {
            success: false,
            tableName,
            error: err.message
          };
        }
      }
    }
    
    await connection.end();
    
    const successCount = Object.values(results).filter(r => r.success).length;
    const totalCount = Object.keys(results).length;
    
    res.json({
      success: successCount > 0,
      message: `Uploaded ${successCount}/${totalCount} tables to database`,
      results
    });
    
  } catch (error) {
    console.error('Database error:', error);
    if (connection) {
      try { await connection.end(); } catch (e) {}
    }
    res.status(500).json({
      success: false,
      message: `Database connection error: ${error.message}`,
      results
    });
  }
});

// Endpoint to test database connection
app.get('/api/test-database', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    await connection.ping();
    await connection.end();
    res.json({ success: true, message: 'Database connection successful' });
  } catch (error) {
    if (connection) {
      try { await connection.end(); } catch (e) {}
    }
    res.status(500).json({ success: false, message: `Database connection failed: ${error.message}` });
  }
});

// Endpoint to upload a single table to database
// ==================== SPECIAL ENDPOINT: Upload rates and generate inventories with correct IDs ====================
// This endpoint handles the complete flow:
// 1. Get MAX(id) from hotel_room_rates before upload
// 2. Upload new rates to database
// 3. Get ONLY the newly inserted rate IDs (id > MAX)
// 4. Generate hotel_room_inventories with those new IDs as rate_id
app.post('/api/upload-rates-and-generate-inventories', express.json({ limit: '50mb' }), async (req, res) => {
  const { hotelId, ratesFileData } = req.body;
  
  if (!hotelId || !ratesFileData) {
    return res.status(400).json({ success: false, message: 'hotelId and ratesFileData are required' });
  }
  
  let connection;
  
  try {
    console.log(`\\n========== UPLOAD RATES & GENERATE INVENTORIES for hotel_id: ${hotelId} ==========`);
    
    connection = await mysql.createConnection(DB_CONFIG);
    
    // STEP 1: Get the current MAX(id) from hotel_room_rates BEFORE uploading
    const [maxIdResult] = await connection.execute(
      'SELECT COALESCE(MAX(id), 0) as max_id FROM hotel_room_rates'
    );
    const maxIdBeforeUpload = maxIdResult[0].max_id;
    console.log(`Current MAX(id) in hotel_room_rates before upload: ${maxIdBeforeUpload}`);
    
    // STEP 2: Parse and upload the rates Excel data
    const base64Data = typeof ratesFileData === 'string' ? ratesFileData : ratesFileData.data;
    const ratesData = await parseExcelFromBase64(base64Data);
    console.log(`Parsed ${ratesData.length} rates from uploaded file`);
    
    if (ratesData.length === 0) {
      await connection.end();
      return res.status(400).json({ success: false, message: 'No rates data found in uploaded file' });
    }
    
    // Update hotel_id for all rates
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const updatedRates = ratesData.map(rate => ({
      ...rate,
      hotel_id: parseInt(hotelId),
      updated_at: now,
      created_at: rate.created_at || now
    }));
    
    // Insert rates into database
    const insertResult = await insertIntoTable(connection, 'hotel_room_rates', updatedRates);
    console.log(`Inserted ${insertResult.inserted}/${insertResult.total} rates into hotel_room_rates`);
    
    // STEP 3: Get ONLY the newly inserted rate IDs (id > maxIdBeforeUpload)
    const [newlyInsertedRates] = await connection.execute(
      'SELECT id, hotel_id, room_category_id, booking_start_date, booking_end_date FROM hotel_room_rates WHERE id > ? AND hotel_id = ? ORDER BY id ASC',
      [maxIdBeforeUpload, hotelId]
    );
    console.log(`Found ${newlyInsertedRates.length} NEWLY inserted rates with IDs: ${newlyInsertedRates.map(r => r.id).join(', ')}`);
    
    if (newlyInsertedRates.length === 0) {
      await connection.end();
      return res.status(400).json({ 
        success: false, 
        message: 'No new rates were inserted. Check if data is valid.',
        uploaded: insertResult
      });
    }
    
    // STEP 4: Fetch room categories for name mapping
    const [categories] = await connection.execute(
      'SELECT id, room_category_name FROM hotel_room_categories WHERE hotel_id = ?',
      [hotelId]
    );
    
    await connection.end();
    
    // Create category ID to name map
    const categoryIdToName = {};
    for (const cat of categories) {
      categoryIdToName[cat.id] = cat.room_category_name;
    }
    
    // STEP 5: Generate inventory files with the NEW rate IDs
    const files = {};
    
    // Helper to create Excel buffer
    async function createExcelBuffer(sheetName, headers, data) {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sheet');
      worksheet.addRow(headers);
      
      if (Array.isArray(data)) {
        data.forEach(row => {
          const rowData = headers.map(h => row[h] !== undefined ? row[h] : '');
          worksheet.addRow(rowData);
        });
      }
      
      const buffer = await workbook.xlsx.writeBuffer();
      return buffer.toString('base64');
    }
    
    // Generate hotel_room_inventories with CORRECT rate_ids from newly inserted rates
    const invHeaders = tableSchemas.hotel_room_inventories;
    const inventoriesData = newlyInsertedRates.map(rate => {
      const startDate = rate.booking_start_date ? new Date(rate.booking_start_date).toISOString().slice(0, 10) : '';
      const endDate = rate.booking_end_date ? new Date(rate.booking_end_date).toISOString().slice(0, 10) : '';
      
      return {
        rate_id: parseInt(rate.id),  // THIS IS THE NEWLY GENERATED AUTO-INCREMENT ID FROM DATABASE
        booking_start_date: startDate,
        booking_end_date: endDate,
        allotment: 10,
        stop_sale_date: '',
        created_at: now,
        updated_at: now
      };
    });
    
    console.log(`Generated ${inventoriesData.length} inventory entries with NEW rate_ids:`, inventoriesData.map(i => i.rate_id).slice(0, 10));
    
    files.hotel_room_inventories = {
      name: 'hotel_room_inventories.xlsx',
      data: await createExcelBuffer('hotel_room_inventories', invHeaders, inventoriesData),
      rows: inventoriesData.length
    };
    
    // Generate hotel_room_daily_inventories
    const dailyHeaders = tableSchemas.hotel_room_daily_inventories;
    const dailyData = [];
    
    for (const rate of newlyInsertedRates) {
      let roomCategoryValue = rate.room_category_id;
      
      // Convert ID to name if it's a number
      if (roomCategoryValue && !isNaN(parseInt(roomCategoryValue))) {
        const categoryName = categoryIdToName[parseInt(roomCategoryValue)];
        if (categoryName) {
          roomCategoryValue = categoryName;
        }
      }
      
      const startDate = rate.booking_start_date ? new Date(rate.booking_start_date) : null;
      const endDate = rate.booking_end_date ? new Date(rate.booking_end_date) : null;
      
      if (startDate && endDate && startDate <= endDate) {
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          dailyData.push({
            hotel_id: parseInt(hotelId),
            inventory_id: 0,
            room_category_id: roomCategoryValue,
            date: currentDate.toISOString().slice(0, 10),
            daily_allotment: 10,
            used: 0,
            balance: 10,
            created_at: now,
            updated_at: now
          });
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    }
    
    console.log(`Generated ${dailyData.length} daily inventory entries`);
    
    files.hotel_room_daily_inventories = {
      name: 'hotel_room_daily_inventories.xlsx',
      data: await createExcelBuffer('hotel_room_daily_inventories', dailyHeaders, dailyData),
      rows: dailyData.length
    };
    
    console.log(`========== COMPLETE: Rates uploaded, inventories generated with correct IDs ==========\\n`);
    
    res.json({
      success: true,
      message: `Rates uploaded successfully! ${newlyInsertedRates.length} new rates inserted. Inventory files generated with correct rate_ids.`,
      hotelId: hotelId,
      ratesUploaded: insertResult,
      newRateIds: newlyInsertedRates.map(r => r.id),
      files: files
    });
    
  } catch (error) {
    console.error('Error in upload-rates-and-generate-inventories:', error);
    if (connection) {
      try { await connection.end(); } catch (e) {}
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload rates and generate inventories'
    });
  }
});

app.post('/api/upload-single-table', express.json({ limit: '50mb' }), async (req, res) => {
  const { tableName, fileData } = req.body;
  
  if (!tableName || !fileData) {
    return res.status(400).json({ success: false, message: 'tableName and fileData are required' });
  }
  
  const dbTableName = TABLE_MAPPING[tableName];
  if (!dbTableName) {
    return res.status(400).json({ success: false, message: `Unknown table: ${tableName}` });
  }
  
  let connection;
  
  try {
    console.log(`\n========== Uploading single table: ${tableName} -> ${dbTableName} ==========`);
    
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('Connected to database');
    
    // Parse Excel from base64 - support both formats: direct base64 string or object with data property
    const base64Data = typeof fileData === 'string' ? fileData : fileData.data;
    const data = await parseExcelFromBase64(base64Data);
    console.log(`Parsed ${data.length} rows from ${tableName}`);
    
    // Log detailed data for debugging
    if (data.length > 0) {
      console.log(`Data columns present: ${Object.keys(data[0]).join(', ')}`);
      console.log(`hotel_id value in first row: ${data[0].hotel_id}`);
    }
    
    // Insert into database
    const result = await insertIntoTable(connection, dbTableName, data);
    console.log(`Inserted ${result.inserted}/${result.total} rows into ${dbTableName}`);
    console.log(`========== Upload complete for ${tableName} ==========\n`);
    
    await connection.end();
    
    res.json({
      success: true,
      tableName: dbTableName,
      ...result
    });
    
  } catch (error) {
    console.error(`Error uploading ${tableName}:`, error);
    if (connection) {
      try { await connection.end(); } catch (e) {}
    }
    res.status(500).json({
      success: false,
      tableName: dbTableName,
      error: error.message
    });
  }
});

// ==================== HOTEL RATES MANAGEMENT APIs ====================

// Get hotel room rates by hotel_id
app.get('/api/get-hotel-rates/:hotelId', async (req, res) => {
  const { hotelId } = req.params;
  
  if (!hotelId) {
    return res.status(400).json({ success: false, message: 'hotelId is required' });
  }
  
  let connection;
  
  try {
    console.log(`Fetching rates for hotel_id: ${hotelId}`);
    connection = await mysql.createConnection(DB_CONFIG);
    
    const [rates] = await connection.execute(
      'SELECT * FROM hotel_room_rates WHERE hotel_id = ?',
      [hotelId]
    );
    
    await connection.end();
    
    console.log(`Found ${rates.length} rate records for hotel_id: ${hotelId}`);
    
    res.json({
      success: true,
      hotelId: hotelId,
      rates: rates,
      count: rates.length
    });
    
  } catch (error) {
    console.error('Error fetching rates:', error.message);
    if (connection) {
      try { await connection.end(); } catch (e) {}
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch rates'
    });
  }
});

// Download rates as Excel file
app.get('/api/download-rates-excel/:hotelId', async (req, res) => {
  const { hotelId } = req.params;
  
  if (!hotelId) {
    return res.status(400).json({ success: false, message: 'hotelId is required' });
  }
  
  let connection;
  
  try {
    // Fetch rates from database instead of receiving in request body
    connection = await mysql.createConnection(DB_CONFIG);
    const [rates] = await connection.execute(
      'SELECT * FROM hotel_room_rates WHERE hotel_id = ?',
      [hotelId]
    );
    await connection.end();
    
    if (rates.length === 0) {
      return res.status(404).json({ success: false, message: 'No rates found for this hotel' });
    }
    
    console.log(`Generating Excel for hotel_id: ${hotelId} with ${rates.length} rates`);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('hotel_room_rates');
    
    // Add headers from tableSchemas
    const headers = tableSchemas.hotel_room_rates;
    worksheet.addRow(headers);
    
    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    
    // Add data rows
    rates.forEach(rate => {
      const rowData = headers.map(col => {
        let value = rate[col];
        // Format dates
        if ((col === 'booking_start_date' || col === 'booking_end_date' || col === 'created_at' || col === 'updated_at') && value) {
          try {
            value = new Date(value).toISOString().slice(0, 10);
          } catch (e) {}
        }
        return value !== undefined && value !== null ? value : '';
      });
      worksheet.addRow(rowData);
    });
    
    // Auto-fit columns
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.min(maxLength + 2, 50);
    });
    
    // Write to buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=hotel_room_rates_${hotelId}.xlsx`);
    res.send(buffer);
    
  } catch (error) {
    console.error('Error generating Excel:', error.message);
    if (connection) {
      try { await connection.end(); } catch (e) {}
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate Excel'
    });
  }
});

// Generate inventory tables from uploaded rates Excel
app.post('/api/generate-inventories-from-rates', express.json({ limit: '50mb' }), async (req, res) => {
  const { hotelId, ratesFileData } = req.body;
  
  if (!hotelId || !ratesFileData) {
    return res.status(400).json({ success: false, message: 'hotelId and ratesFileData are required' });
  }
  
  let connection;
  
  try {
    console.log(`\\n========== Generating rates file for hotel_id: ${hotelId} ==========`);
    
    // Parse the uploaded rates Excel
    const ratesData = await parseExcelFromBase64(ratesFileData);
    console.log(`Parsed ${ratesData.length} rates from uploaded file`);
    
    if (ratesData.length === 0) {
      return res.status(400).json({ success: false, message: 'No rates data found in uploaded file' });
    }
    
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const files = {};
    
    // Helper to create Excel buffer
    async function createExcelBuffer(sheetName, headers, data) {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sheet');
      worksheet.addRow(headers);
      
      if (Array.isArray(data)) {
        data.forEach(row => {
          const rowData = headers.map(h => row[h] !== undefined ? row[h] : '');
          worksheet.addRow(rowData);
        });
      }
      
      const buffer = await workbook.xlsx.writeBuffer();
      return buffer.toString('base64');
    }
    
    // STEP 1: Generate ONLY hotel_room_rates table
    // The inventory tables will be generated AFTER rates are uploaded to DB
    // because we need the auto-increment IDs from the database
    const ratesHeaders = tableSchemas.hotel_room_rates;
    const updatedRates = ratesData.map(rate => ({
      ...rate,
      hotel_id: hotelId,
      updated_at: now
    }));
    
    files.hotel_room_rates = {
      name: 'hotel_room_rates.xlsx',
      data: await createExcelBuffer('hotel_room_rates', ratesHeaders, updatedRates),
      rows: updatedRates.length
    };
    
    console.log(`Generated hotel_room_rates file with ${updatedRates.length} rows`);
    console.log(`NOTE: Inventory files will be generated AFTER rates are uploaded to database`);
    
    res.json({
      success: true,
      message: `Generated hotel_room_rates file. Upload it to database first, then inventory files will be generated with correct rate_ids.`,
      hotelId: hotelId,
      files: files,
      note: 'Upload hotel_room_rates first. Inventory tables will be generated after with correct rate_ids from database.'
    });
    
  } catch (error) {
    console.error('Error generating rates file:', error.message);
    if (connection) {
      try { await connection.end(); } catch (e) {}
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate rates file'
    });
  }
});

// Regenerate inventory tables with correct rate_ids from database (after hotel_room_rates is uploaded)
app.post('/api/regenerate-inventories-with-rate-ids', express.json({ limit: '50mb' }), async (req, res) => {
  const { hotelId } = req.body;
  
  if (!hotelId) {
    return res.status(400).json({ success: false, message: 'hotelId is required' });
  }
  
  let connection;
  
  try {
    console.log(`\n========== Regenerating inventories with rate_ids from DB for hotel_id: ${hotelId} ==========`);
    
    connection = await mysql.createConnection(DB_CONFIG);
    
    // Fetch the actual rate records from database (with their auto-generated IDs)
    // These IDs are the auto-increment values that were assigned when rates were inserted
    const [rates] = await connection.execute(
      'SELECT id, hotel_id, room_category_id, booking_start_date, booking_end_date, meal_plan, market_nationality FROM hotel_room_rates WHERE hotel_id = ? ORDER BY id ASC',
      [hotelId]
    );
    
    console.log(`Found ${rates.length} rate records in database for hotel_id: ${hotelId}`);
    if (rates.length > 0) {
      console.log(`Rate IDs from database: ${rates.map(r => r.id).join(', ')}`);
    }
    
    if (rates.length === 0) {
      await connection.end();
      return res.status(400).json({ success: false, message: 'No rates found in database for this hotel. Please upload hotel_room_rates first.' });
    }
    
    // Fetch room categories to get names
    const [categories] = await connection.execute(
      'SELECT id, room_category_name FROM hotel_room_categories WHERE hotel_id = ?',
      [hotelId]
    );
    
    await connection.end();
    
    // Create category ID to name map
    const categoryIdToName = {};
    for (const cat of categories) {
      categoryIdToName[cat.id] = cat.room_category_name;
    }
    
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const files = {};
    
    // Helper to create Excel buffer
    async function createExcelBuffer(sheetName, headers, data) {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sheet');
      worksheet.addRow(headers);
      
      if (Array.isArray(data)) {
        data.forEach(row => {
          const rowData = headers.map(h => row[h] !== undefined ? row[h] : '');
          worksheet.addRow(rowData);
        });
      }
      
      const buffer = await workbook.xlsx.writeBuffer();
      return buffer.toString('base64');
    }
    
    // 1. Generate hotel_room_inventories with correct rate_ids from database
    // CRITICAL: rate_id MUST be the auto-increment ID from hotel_room_rates table
    const invHeaders = tableSchemas.hotel_room_inventories;
    const inventoriesData = rates.map(rate => {
      const startDate = rate.booking_start_date ? new Date(rate.booking_start_date).toISOString().slice(0, 10) : '';
      const endDate = rate.booking_end_date ? new Date(rate.booking_end_date).toISOString().slice(0, 10) : '';
      
      // Ensure rate.id is properly converted to integer - this is the auto-increment ID from database
      const rateIdValue = parseInt(rate.id, 10);
      
      if (isNaN(rateIdValue)) {
        console.warn(`Warning: Invalid rate ID for rate:`, rate);
      }
      
      return {
        rate_id: rateIdValue,  // This is the actual ID from database (auto-increment)
        booking_start_date: startDate,
        booking_end_date: endDate,
        allotment: 10,
        stop_sale_date: '',
        created_at: now,
        updated_at: now
      };
    });
    
    console.log(`Generated ${inventoriesData.length} inventory entries with rate_ids:`, inventoriesData.slice(0, 10).map(i => i.rate_id));
    console.log(`First inventory entry:`, JSON.stringify(inventoriesData[0]));
    
    files.hotel_room_inventories = {
      name: 'hotel_room_inventories.xlsx',
      data: await createExcelBuffer('hotel_room_inventories', invHeaders, inventoriesData),
      rows: inventoriesData.length
    };
    
    // 2. Generate hotel_room_daily_inventories with category NAMES (not IDs) - Issue 02 fix
    const dailyHeaders = tableSchemas.hotel_room_daily_inventories;
    const dailyData = [];
    
    for (const rate of rates) {
      // Get room_category_id value - convert to name if it's an ID
      let roomCategoryValue = rate.room_category_id;
      
      // If room_category_id is a number, convert to name
      if (roomCategoryValue && !isNaN(parseInt(roomCategoryValue))) {
        const categoryName = categoryIdToName[parseInt(roomCategoryValue)];
        if (categoryName) {
          roomCategoryValue = categoryName;
        }
      }
      
      const startDate = rate.booking_start_date ? new Date(rate.booking_start_date) : null;
      const endDate = rate.booking_end_date ? new Date(rate.booking_end_date) : null;
      
      if (startDate && endDate && startDate <= endDate) {
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          dailyData.push({
            hotel_id: parseInt(hotelId),
            inventory_id: 0,
            room_category_id: roomCategoryValue,  // This is now the NAME, not ID
            date: currentDate.toISOString().slice(0, 10),
            daily_allotment: 10,
            used: 0,
            balance: 10,
            created_at: now,
            updated_at: now
          });
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    }
    
    console.log(`Generated ${dailyData.length} daily inventory entries with category names`);
    
    files.hotel_room_daily_inventories = {
      name: 'hotel_room_daily_inventories.xlsx',
      data: await createExcelBuffer('hotel_room_daily_inventories', dailyHeaders, dailyData),
      rows: dailyData.length
    };
    
    res.json({
      success: true,
      message: `Regenerated inventory tables with ${rates.length} rate IDs from database`,
      hotelId: hotelId,
      ratesCount: rates.length,
      files: files
    });
    
  } catch (error) {
    console.error('Error regenerating inventories:', error.message);
    if (connection) {
      try { await connection.end(); } catch (e) {}
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to regenerate inventories'
    });
  }
});

// Add new room category
app.post('/api/add-room-category', express.json(), async (req, res) => {
  const { hotelId, categoryName } = req.body;
  
  if (!hotelId || !categoryName) {
    return res.status(400).json({ success: false, message: 'hotelId and categoryName are required' });
  }
  
  let connection;
  
  try {
    console.log(`Adding room category "${categoryName}" for hotel_id: ${hotelId}`);
    
    connection = await mysql.createConnection(DB_CONFIG);
    
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    const [result] = await connection.execute(
      'INSERT INTO hotel_room_categories (hotel_id, room_category_name, created_at, updated_at) VALUES (?, ?, ?, ?)',
      [hotelId, categoryName, now, now]
    );
    
    await connection.end();
    
    console.log(`Room category added with ID: ${result.insertId}`);
    
    res.json({
      success: true,
      message: `Room category "${categoryName}" added successfully`,
      categoryId: result.insertId,
      hotelId: hotelId
    });
    
  } catch (error) {
    console.error('Error adding room category:', error.message);
    if (connection) {
      try { await connection.end(); } catch (e) {}
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add room category'
    });
  }
});

// ==================== LIFESTYLE DATA UPLOAD WITH FK MAPPING ====================
// This endpoint handles the lifestyle data upload with proper foreign key relationships:
// 1. Upload tbl_lifestyle -> get lifestyle_id (auto-increment)
// 2. Upload tbl_lifestyle_detail with mapped lifestyle_id
// 3. Upload tbl_lifestyle_rates -> get lifestyle_rate_id (auto-increment)
// 4. Upload life_style_rates_packages with mapped rate_id (= lifestyle_rate_id)
// 5. Upload tbl_lifestyle_inventory with mapped lifestyle_id and rate_id
// 6. Upload tbl_lifestyle_terms_and_conditions with mapped lifestyle_id

// Configure multer for lifestyle file uploads (memory storage for parsing Excel directly)
const lifestyleUploadStorage = multer.memoryStorage();
const lifestyleUpload = multer({ 
  storage: lifestyleUploadStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'), false);
    }
  }
});

// Helper function to parse Excel from buffer
async function parseExcelFromBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  
  if (!worksheet || worksheet.rowCount === 0) {
    return [];
  }
  
  const headers = [];
  const data = [];
  
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, colNumber) => {
        headers[colNumber - 1] = cell.value?.toString() || `col_${colNumber}`;
      });
    } else {
      const rowData = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          rowData[header] = cell.value;
        }
      });
      if (Object.keys(rowData).length > 0) {
        data.push(rowData);
      }
    }
  });
  
  return data;
}

// Define fields for lifestyle upload
const lifestyleUploadFields = lifestyleUpload.fields([
  { name: 'tbl_lifestyle', maxCount: 1 },
  { name: 'tbl_lifestyle_detail', maxCount: 1 },
  { name: 'tbl_lifestyle_rates', maxCount: 1 },
  { name: 'life_style_rates_packages', maxCount: 1 },
  { name: 'tbl_lifestyle_inventory', maxCount: 1 },
  { name: 'tbl_lifestyle_terms_and_conditions', maxCount: 1 }
]);

app.post('/api/upload-lifestyle-to-database', lifestyleUploadFields, async (req, res) => {
  const files = req.files;
  
  if (!files || Object.keys(files).length === 0) {
    return res.status(400).json({ success: false, message: 'No files provided' });
  }
  
  console.log('Received files:', Object.keys(files));
  
  // ========================================================================
  // VALIDATION: Ensure parent tables are present when child tables are uploaded
  // ========================================================================
  const fileKeys = Object.keys(files);
  const hasDetail = fileKeys.includes('tbl_lifestyle_detail');
  const hasRates = fileKeys.includes('tbl_lifestyle_rates');
  const hasPackages = fileKeys.includes('life_style_rates_packages');
  const hasInventory = fileKeys.includes('tbl_lifestyle_inventory');
  const hasTerms = fileKeys.includes('tbl_lifestyle_terms_and_conditions');
  const hasLifestyle = fileKeys.includes('tbl_lifestyle');
  
  // Check: If any child table needs lifestyle_id, tbl_lifestyle must be present
  if ((hasDetail || hasRates || hasInventory || hasTerms) && !hasLifestyle) {
    return res.status(400).json({ 
      success: false, 
      message: 'tbl_lifestyle.xlsx is required when uploading detail, rates, inventory, or terms tables. The lifestyle_id must be generated first.' 
    });
  }
  
  // Check: If packages or inventory need rate_id, tbl_lifestyle_rates must be present
  if ((hasPackages || hasInventory) && !hasRates) {
    return res.status(400).json({ 
      success: false, 
      message: 'tbl_lifestyle_rates.xlsx is required when uploading packages or inventory tables. The rate_id (lifestyle_rate_id) must be generated first.' 
    });
  }
  
  let connection;
  const results = {};
  
  // Mapping dictionaries to track auto-generated IDs
  const lifestyleIdMap = {}; // product_index -> lifestyle_id
  const lifestyleRateIdMap = {}; // rate_index -> lifestyle_rate_id
  
  try {
    console.log('\n========== LIFESTYLE DATA UPLOAD WITH FK MAPPING ==========');
    console.log('Connecting to database...');
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('Connected to database successfully');
    
    // ========================================================================
    // START TRANSACTION - Ensures all-or-nothing insert with rollback on failure
    // ========================================================================
    await connection.query('START TRANSACTION');
    console.log('🔒 Transaction started - All inserts will be rolled back if any step fails');
    
      // ========================================================================
      // STEP 1: Upload tbl_lifestyle and get lifestyle_id for each product
      // This MUST be done first - all other tables depend on lifestyle_id
      // ========================================================================
      if (files.tbl_lifestyle && files.tbl_lifestyle[0]) {
        console.log('\nSTEP 1: Uploading tbl_lifestyle (Main Table - generates lifestyle_id)');
        const fileBuffer = files.tbl_lifestyle[0].buffer;
        const data = await parseExcelFromBuffer(fileBuffer);
        console.log(`  Parsed ${data.length} lifestyle products`);
        console.log(`  First row columns:`, data.length > 0 ? Object.keys(data[0]) : 'No data');
        
        let insertedCount = 0;
        for (const row of data) {
          // Get product_index for mapping - default to row index if not present
          const productIndex = row.product_index !== undefined ? Number(row.product_index) : insertedCount;
          console.log(`  Processing row with product_index: ${productIndex}`);
          
          // Remove mapping columns and auto-increment column
          const cleanRow = { ...row };
          delete cleanRow.product_index;
          delete cleanRow.rate_index;
          delete cleanRow.lifestyle_id;
          
          // Ensure required fields have default values
          if (!cleanRow.image) cleanRow.image = '';
          
          // Remove null/undefined values (except image which we set)
          Object.keys(cleanRow).forEach(key => {
            if (key !== 'image' && (cleanRow[key] === null || cleanRow[key] === undefined || cleanRow[key] === '')) {
              delete cleanRow[key];
            }
          });
          
          if (Object.keys(cleanRow).length === 0) continue;
          
          const columns = Object.keys(cleanRow).join(', ');
          const placeholders = Object.keys(cleanRow).map(() => '?').join(', ');
          const values = Object.values(cleanRow);
          
          const [result] = await connection.execute(
            `INSERT INTO tbl_lifestyle (${columns}) VALUES (${placeholders})`,
            values
          );
          
          // Store the mapping: product_index -> lifestyle_id (CRITICAL for FK mapping)
          // Also store by row index as fallback
          lifestyleIdMap[productIndex] = result.insertId;
          lifestyleIdMap[insertedCount] = result.insertId; // Fallback mapping by row index
          console.log(`    ✅ Inserted product_index ${productIndex} (row ${insertedCount}) -> lifestyle_id: ${result.insertId}`);
          insertedCount++;
        }
        
        // Store the first/default lifestyle_id for tables without product_index
        if (insertedCount > 0) {
          lifestyleIdMap['default'] = lifestyleIdMap[0];
        }
        
        results.tbl_lifestyle = { success: true, inserted: insertedCount, total: data.length, lifestyleId: lifestyleIdMap[0] };
        console.log(`  ✅ Inserted ${insertedCount}/${data.length} rows into tbl_lifestyle`);
        console.log(`  📋 Lifestyle ID Mapping:`, JSON.stringify(lifestyleIdMap));
      }
    
    // ========================================================================
    // STEP 2: Upload tbl_lifestyle_detail with mapped lifestyle_id
    // lifestyle_id is obtained from Step 1 using product_index mapping
    // ========================================================================
    if (files.tbl_lifestyle_detail && files.tbl_lifestyle_detail[0]) {
      console.log('\nSTEP 2: Uploading tbl_lifestyle_detail (uses lifestyle_id from Step 1)');
      console.log(`  Available lifestyle IDs:`, JSON.stringify(lifestyleIdMap));
      const fileBuffer = files.tbl_lifestyle_detail[0].buffer;
      const data = await parseExcelFromBuffer(fileBuffer);
      console.log(`  Parsed ${data.length} detail records`);
      console.log(`  First row columns:`, data.length > 0 ? Object.keys(data[0]) : 'No data');
      
      let insertedCount = 0;
      for (const row of data) {
        // Get product_index - try multiple fallbacks
        let productIndex = 0;
        if (row.product_index !== undefined) {
          productIndex = Number(row.product_index);
        }
        
        const cleanRow = { ...row };
        delete cleanRow.product_index;
        delete cleanRow.rate_index;
        delete cleanRow.lifestyle_detail_id;
        
        // Map lifestyle_id from Step 1 - CRITICAL FK MAPPING
        // Try product_index first, then row index, then default
        cleanRow.lifestyle_id = lifestyleIdMap[productIndex] || lifestyleIdMap[insertedCount] || lifestyleIdMap['default'] || lifestyleIdMap[0];
        
        console.log(`  Row ${insertedCount}: product_index=${productIndex}, mapped lifestyle_id=${cleanRow.lifestyle_id}`);
        
        if (!cleanRow.lifestyle_id) {
          console.log(`    ⚠️ Skipping detail record - no lifestyle_id found for product_index ${productIndex}`);
          console.log(`    Available mappings:`, JSON.stringify(lifestyleIdMap));
          continue;
        }
        
        Object.keys(cleanRow).forEach(key => {
          if (cleanRow[key] === null || cleanRow[key] === undefined || cleanRow[key] === '') {
            delete cleanRow[key];
          }
        });
        
        if (Object.keys(cleanRow).length === 0) continue;
        
        const columns = Object.keys(cleanRow).join(', ');
        const placeholders = Object.keys(cleanRow).map(() => '?').join(', ');
        const values = Object.values(cleanRow);
        
        await connection.execute(
          `INSERT INTO tbl_lifestyle_detail (${columns}) VALUES (${placeholders})`,
          values
        );
        console.log(`    ✅ Inserted detail with lifestyle_id: ${cleanRow.lifestyle_id}`);
        insertedCount++;
      }
      
      results.tbl_lifestyle_detail = { success: true, inserted: insertedCount, total: data.length };
      console.log(`  ✅ Inserted ${insertedCount}/${data.length} rows into tbl_lifestyle_detail`);
    }
    
    // ========================================================================
    // STEP 3: Upload tbl_lifestyle_rates and get lifestyle_rate_id
    // lifestyle_id from Step 1, generates lifestyle_rate_id for Steps 4 & 5
    // ========================================================================
    if (files.tbl_lifestyle_rates && files.tbl_lifestyle_rates[0]) {
      console.log('\nSTEP 3: Uploading tbl_lifestyle_rates (uses lifestyle_id, generates lifestyle_rate_id)');
      console.log(`  Available lifestyle IDs:`, JSON.stringify(lifestyleIdMap));
      const fileBuffer = files.tbl_lifestyle_rates[0].buffer;
      const data = await parseExcelFromBuffer(fileBuffer);
      console.log(`  Parsed ${data.length} rate records`);
      console.log(`  First row columns:`, data.length > 0 ? Object.keys(data[0]) : 'No data');
      
      let insertedCount = 0;
      for (const row of data) {
        // Get product_index and rate_index with fallbacks
        let productIndex = row.product_index !== undefined ? Number(row.product_index) : 0;
        let rateIndex = row.rate_index !== undefined ? Number(row.rate_index) : insertedCount;
        
        const cleanRow = { ...row };
        delete cleanRow.product_index;
        delete cleanRow.rate_index;
        delete cleanRow.lifestyle_rate_id;
        
        // Map lifestyle_id from Step 1 - with fallbacks
        cleanRow.lifestyle_id = lifestyleIdMap[productIndex] || lifestyleIdMap[0] || lifestyleIdMap['default'];
        
        console.log(`  Row ${insertedCount}: product_index=${productIndex}, rate_index=${rateIndex}, mapped lifestyle_id=${cleanRow.lifestyle_id}`);
        
        if (!cleanRow.lifestyle_id) {
          console.log(`    ⚠️ Skipping rate record - no lifestyle_id found`);
          console.log(`    Available mappings:`, JSON.stringify(lifestyleIdMap));
          continue;
        }
        
        Object.keys(cleanRow).forEach(key => {
          if (cleanRow[key] === null || cleanRow[key] === undefined || cleanRow[key] === '') {
            delete cleanRow[key];
          }
        });
        
        if (Object.keys(cleanRow).length === 0) continue;
        
        const columns = Object.keys(cleanRow).join(', ');
        const placeholders = Object.keys(cleanRow).map(() => '?').join(', ');
        const values = Object.values(cleanRow);
        
        const [result] = await connection.execute(
          `INSERT INTO tbl_lifestyle_rates (${columns}) VALUES (${placeholders})`,
          values
        );
        
        // Store the mapping: rate_index -> lifestyle_rate_id (CRITICAL for Steps 4 & 5)
        // Also store by row index as fallback
        lifestyleRateIdMap[rateIndex] = result.insertId;
        lifestyleRateIdMap[insertedCount] = result.insertId;
        console.log(`    ✅ Inserted rate_index ${rateIndex} (row ${insertedCount}) -> lifestyle_rate_id: ${result.insertId} (lifestyle_id: ${cleanRow.lifestyle_id})`);
        insertedCount++;
      }
      
      // Store default rate_id for tables without rate_index
      if (insertedCount > 0) {
        lifestyleRateIdMap['default'] = lifestyleRateIdMap[0];
      }
      
      results.tbl_lifestyle_rates = { success: true, inserted: insertedCount, total: data.length, lifestyleRateId: lifestyleRateIdMap[0] };
      console.log(`  ✅ Inserted ${insertedCount}/${data.length} rows into tbl_lifestyle_rates`);
      console.log(`  📋 Rate ID Mapping:`, JSON.stringify(lifestyleRateIdMap));
    }
    
    // ========================================================================
    // STEP 4: Upload life_style_rates_packages with mapped rate_id
    // rate_id = lifestyle_rate_id from Step 3
    // ========================================================================
    if (files.life_style_rates_packages && files.life_style_rates_packages[0]) {
      console.log('\nSTEP 4: Uploading life_style_rates_packages (rate_id = lifestyle_rate_id from Step 3)');
      console.log(`  Available rate IDs:`, JSON.stringify(lifestyleRateIdMap));
      const fileBuffer = files.life_style_rates_packages[0].buffer;
      const data = await parseExcelFromBuffer(fileBuffer);
      console.log(`  Parsed ${data.length} package records`);
      console.log(`  First row columns:`, data.length > 0 ? Object.keys(data[0]) : 'No data');
      
      let insertedCount = 0;
      for (const row of data) {
        // Get rate_index with fallbacks
        let rateIndex = row.rate_index !== undefined ? Number(row.rate_index) : insertedCount;
        
        const cleanRow = { ...row };
        delete cleanRow.product_index;
        delete cleanRow.rate_index;
        delete cleanRow.id;
        
        // Map rate_id from Step 3 (lifestyle_rate_id) - with fallbacks
        cleanRow.rate_id = lifestyleRateIdMap[rateIndex] || lifestyleRateIdMap[insertedCount] || lifestyleRateIdMap['default'] || lifestyleRateIdMap[0];
        
        console.log(`  Row ${insertedCount}: rate_index=${rateIndex}, mapped rate_id=${cleanRow.rate_id}`);
        
        if (!cleanRow.rate_id) {
          console.log(`    ⚠️ Skipping package record - no rate_id found`);
          console.log(`    Available mappings:`, JSON.stringify(lifestyleRateIdMap));
          continue;
        }
        
        Object.keys(cleanRow).forEach(key => {
          if (cleanRow[key] === null || cleanRow[key] === undefined || cleanRow[key] === '') {
            delete cleanRow[key];
          }
        });
        
        if (Object.keys(cleanRow).length === 0) continue;
        
        const columns = Object.keys(cleanRow).join(', ');
        const placeholders = Object.keys(cleanRow).map(() => '?').join(', ');
        const values = Object.values(cleanRow);
        
        await connection.execute(
          `INSERT INTO life_style_rates_packages (${columns}) VALUES (${placeholders})`,
          values
        );
        console.log(`    ✅ Inserted package with rate_id: ${cleanRow.rate_id}`);
        insertedCount++;
      }
      
      results.life_style_rates_packages = { success: true, inserted: insertedCount, total: data.length };
      console.log(`  ✅ Inserted ${insertedCount}/${data.length} rows into life_style_rates_packages`);
    }
    
    // ========================================================================
    // STEP 5: Upload tbl_lifestyle_inventory with mapped lifestyle_id and rate_id
    // lifestyle_id from Step 1, rate_id = lifestyle_rate_id from Step 3
    // ========================================================================
    if (files.tbl_lifestyle_inventory && files.tbl_lifestyle_inventory[0]) {
      console.log('\nSTEP 5: Uploading tbl_lifestyle_inventory (lifestyle_id from Step 1, rate_id from Step 3)');
      console.log(`  Available lifestyle IDs:`, JSON.stringify(lifestyleIdMap));
      console.log(`  Available rate IDs:`, JSON.stringify(lifestyleRateIdMap));
      const fileBuffer = files.tbl_lifestyle_inventory[0].buffer;
      const data = await parseExcelFromBuffer(fileBuffer);
      console.log(`  Parsed ${data.length} inventory records`);
      console.log(`  First row columns:`, data.length > 0 ? Object.keys(data[0]) : 'No data');
      
      let insertedCount = 0;
      let skippedCount = 0;
      const batchSize = 100;
      
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        let batchInserted = 0;
        
        for (const row of batch) {
          // Get product_index and rate_index with fallbacks
          let productIndex = row.product_index !== undefined ? Number(row.product_index) : 0;
          let rateIndex = row.rate_index !== undefined ? Number(row.rate_index) : 0;
          
          const cleanRow = { ...row };
          delete cleanRow.product_index;
          delete cleanRow.rate_index;
          delete cleanRow.lifestyle_inventory_id;
          
          // Map lifestyle_id and rate_id from previous steps - with fallbacks
          cleanRow.lifestyle_id = lifestyleIdMap[productIndex] || lifestyleIdMap[0] || lifestyleIdMap['default'];
          cleanRow.rate_id = lifestyleRateIdMap[rateIndex] || lifestyleRateIdMap[0] || lifestyleRateIdMap['default'];
          
          if (!cleanRow.lifestyle_id || !cleanRow.rate_id) {
            if (batchInserted === 0 && insertedCount === 0) {
              // Log first skip for debugging
              console.log(`  ⚠️ First skip: product_index=${productIndex}, rate_index=${rateIndex}, lifestyle_id=${cleanRow.lifestyle_id}, rate_id=${cleanRow.rate_id}`);
            }
            skippedCount++;
            continue;
          }
          
          Object.keys(cleanRow).forEach(key => {
            if (cleanRow[key] === null || cleanRow[key] === undefined || cleanRow[key] === '') {
              delete cleanRow[key];
            }
          });
          
          if (Object.keys(cleanRow).length === 0) continue;
          
          const columns = Object.keys(cleanRow).join(', ');
          const placeholders = Object.keys(cleanRow).map(() => '?').join(', ');
          const values = Object.values(cleanRow);
          
          await connection.execute(
            `INSERT INTO tbl_lifestyle_inventory (${columns}) VALUES (${placeholders})`,
            values
          );
          insertedCount++;
          batchInserted++;
        }
        
        console.log(`    📦 Inserted batch ${Math.floor(i/batchSize) + 1} (${insertedCount}/${data.length})`);
      }
      
      if (skippedCount > 0) {
        console.log(`    ⚠️ Skipped ${skippedCount} records due to missing lifestyle_id or rate_id`);
      }
      results.tbl_lifestyle_inventory = { success: true, inserted: insertedCount, total: data.length, skipped: skippedCount };
      console.log(`  ✅ Inserted ${insertedCount}/${data.length} rows into tbl_lifestyle_inventory`);
    }
    
    // ========================================================================
    // STEP 6: Upload tbl_lifestyle_terms_and_conditions with mapped lifestyle_id
    // lifestyle_id from Step 1
    // ========================================================================
    if (files.tbl_lifestyle_terms_and_conditions && files.tbl_lifestyle_terms_and_conditions[0]) {
      console.log('\nSTEP 6: Uploading tbl_lifestyle_terms_and_conditions (lifestyle_id from Step 1)');
      console.log(`  Available lifestyle IDs:`, JSON.stringify(lifestyleIdMap));
      const fileBuffer = files.tbl_lifestyle_terms_and_conditions[0].buffer;
      const data = await parseExcelFromBuffer(fileBuffer);
      console.log(`  Parsed ${data.length} terms records`);
      console.log(`  First row columns:`, data.length > 0 ? Object.keys(data[0]) : 'No data');
      
      let insertedCount = 0;
      for (const row of data) {
        // Get product_index with fallbacks
        let productIndex = row.product_index !== undefined ? Number(row.product_index) : 0;
        
        const cleanRow = { ...row };
        delete cleanRow.product_index;
        delete cleanRow.rate_index;
        delete cleanRow.termsncondition_id;
        
        // Map lifestyle_id from Step 1 - with fallbacks
        cleanRow.lifestyle_id = lifestyleIdMap[productIndex] || lifestyleIdMap[insertedCount] || lifestyleIdMap['default'] || lifestyleIdMap[0];
        
        console.log(`  Row ${insertedCount}: product_index=${productIndex}, mapped lifestyle_id=${cleanRow.lifestyle_id}`);
        
        if (!cleanRow.lifestyle_id) {
          console.log(`    ⚠️ Skipping terms record - no lifestyle_id found`);
          console.log(`    Available mappings:`, JSON.stringify(lifestyleIdMap));
          continue;
        }
        
        Object.keys(cleanRow).forEach(key => {
          if (cleanRow[key] === null || cleanRow[key] === undefined || cleanRow[key] === '') {
            delete cleanRow[key];
          }
        });
        
        if (Object.keys(cleanRow).length === 0) continue;
        
        const columns = Object.keys(cleanRow).join(', ');
        const placeholders = Object.keys(cleanRow).map(() => '?').join(', ');
        const values = Object.values(cleanRow);
        
        await connection.execute(
          `INSERT INTO tbl_lifestyle_terms_and_conditions (${columns}) VALUES (${placeholders})`,
          values
        );
        console.log(`    ✅ Inserted terms with lifestyle_id: ${cleanRow.lifestyle_id}`);
        insertedCount++;
      }
      
      results.tbl_lifestyle_terms_and_conditions = { success: true, inserted: insertedCount, total: data.length };
      console.log(`  ✅ Inserted ${insertedCount}/${data.length} rows into tbl_lifestyle_terms_and_conditions`);
    }
    
    // ========================================================================
    // COMMIT TRANSACTION - All inserts successful
    // ========================================================================
    await connection.query('COMMIT');
    console.log('\n✅ TRANSACTION COMMITTED - All data saved successfully');
    
    await connection.end();
    
    const successCount = Object.values(results).filter(r => r.success).length;
    const totalCount = Object.keys(results).length;
    
    // Get the first lifestyle_id that was created
    const lifestyleIds = Object.values(lifestyleIdMap);
    const firstLifestyleId = lifestyleIds.length > 0 ? lifestyleIds[0] : null;
    
    console.log('\n========== UPLOAD SUMMARY ==========');
    console.log(`✅ Successful: ${successCount}/${totalCount} tables`);
    console.log(`📋 Lifestyle ID Mapping: ${JSON.stringify(lifestyleIdMap)}`);
    console.log(`📋 Rate ID Mapping: ${JSON.stringify(lifestyleRateIdMap)}`);
    console.log('=====================================\n');
    
    res.json({
      success: successCount > 0,
      message: `Uploaded ${successCount}/${totalCount} lifestyle tables to database`,
      lifestyle_id: firstLifestyleId,
      results,
      mappings: {
        lifestyleIdMap,
        lifestyleRateIdMap
      }
    });
    
  } catch (error) {
    // ========================================================================
    // ROLLBACK TRANSACTION - Error occurred, undo all inserts
    // ========================================================================
    console.error('\n❌ ERROR OCCURRED - Rolling back transaction:', error.message);
    if (connection) {
      try { 
        await connection.query('ROLLBACK');
        console.log('🔄 TRANSACTION ROLLED BACK - No data was saved');
        await connection.end(); 
      } catch (e) {
        console.error('Error during rollback:', e.message);
      }
    }
    res.status(500).json({
      success: false,
      message: `Database error: ${error.message}. Transaction rolled back - no data was saved.`,
      results
    });
  }
});

// ============================================================================
// STEP-BY-STEP LIFESTYLE UPLOAD API
// ============================================================================
// This API allows uploading lifestyle tables ONE AT A TIME in sequence:
// Step 1: Upload tbl_lifestyle → returns lifestyle_id
// Step 2: Generate & download tbl_lifestyle_detail.xlsx with lifestyle_id → upload → done
// Step 3: Generate & download tbl_lifestyle_rates.xlsx with lifestyle_id → upload → returns lifestyle_rate_id
// Step 4: Generate & download life_style_rates_packages.xlsx with rate_id → upload → done
// Step 5: Generate & download tbl_lifestyle_inventory.xlsx with lifestyle_id & rate_id → upload → done
// Step 6: Generate & download tbl_lifestyle_terms_and_conditions.xlsx with lifestyle_id → upload → done
// ============================================================================

// Single file upload for step-by-step process
const singleFileUpload = multer({ 
  storage: lifestyleUploadStorage,
  limits: { fileSize: 50 * 1024 * 1024 }
}).single('file');

// STEP 1: Upload tbl_lifestyle and get lifestyle_id
app.post('/api/lifestyle-step/upload-lifestyle', singleFileUpload, async (req, res) => {
  console.log('\n========== STEP 1: Upload tbl_lifestyle ==========');
  let connection = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const data = await parseExcelFromBuffer(req.file.buffer);
    console.log(`Parsed ${data.length} lifestyle records`);
    
    if (data.length === 0) {
      return res.status(400).json({ success: false, message: 'Excel file is empty' });
    }
    
    connection = await mysql.createConnection(DB_CONFIG);
    await connection.query('START TRANSACTION');
    
    const insertedIds = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const cleanRow = { ...row };
      
      // Remove auto-increment and mapping columns
      delete cleanRow.lifestyle_id;
      delete cleanRow.product_index;
      delete cleanRow.rate_index;
      
      // Handle image field
      if (!cleanRow.image) cleanRow.image = '';
      
      // Remove null/empty values
      Object.keys(cleanRow).forEach(key => {
        if (cleanRow[key] === null || cleanRow[key] === undefined || cleanRow[key] === '') {
          delete cleanRow[key];
        }
      });
      
      // Re-add image if it was removed
      if (!cleanRow.image) cleanRow.image = '';
      
      const columns = Object.keys(cleanRow).join(', ');
      const placeholders = Object.keys(cleanRow).map(() => '?').join(', ');
      const values = Object.values(cleanRow);
      
      const [result] = await connection.execute(
        `INSERT INTO tbl_lifestyle (${columns}) VALUES (${placeholders})`,
        values
      );
      
      insertedIds.push(result.insertId);
      console.log(`  ✅ Inserted row ${i + 1} -> lifestyle_id: ${result.insertId}`);
    }
    
    await connection.query('COMMIT');
    await connection.end();
    
    console.log(`✅ Successfully inserted ${insertedIds.length} lifestyle records`);
    console.log(`📋 Lifestyle IDs: ${JSON.stringify(insertedIds)}`);
    
    res.json({
      success: true,
      message: `Successfully uploaded ${insertedIds.length} lifestyle records`,
      lifestyle_ids: insertedIds,
      lifestyle_id: insertedIds[0], // Primary ID for single product
      step: 1,
      nextStep: 2
    });
    
  } catch (error) {
    console.error('❌ Error in Step 1:', error.message);
    if (connection) {
      try { await connection.query('ROLLBACK'); await connection.end(); } catch (e) {}
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// STEP 2: Upload tbl_lifestyle_detail with lifestyle_id
app.post('/api/lifestyle-step/upload-lifestyle-detail', singleFileUpload, async (req, res) => {
  console.log('\n========== STEP 2: Upload tbl_lifestyle_detail ==========');
  let connection = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const lifestyleId = req.body.lifestyle_id;
    console.log(`Using lifestyle_id from request: ${lifestyleId}`);
    
    const data = await parseExcelFromBuffer(req.file.buffer);
    console.log(`Parsed ${data.length} detail records`);
    
    if (data.length === 0) {
      return res.status(400).json({ success: false, message: 'Excel file is empty' });
    }
    
    connection = await mysql.createConnection(DB_CONFIG);
    await connection.query('START TRANSACTION');
    
    let insertedCount = 0;
    
    for (const row of data) {
      const cleanRow = { ...row };
      
      // Remove auto-increment and mapping columns
      delete cleanRow.lifestyle_detail_id;
      delete cleanRow.product_index;
      delete cleanRow.rate_index;
      
      // Use lifestyle_id from the Excel file if present, otherwise from request body
      if (!cleanRow.lifestyle_id && lifestyleId) {
        cleanRow.lifestyle_id = parseInt(lifestyleId);
      }
      
      if (!cleanRow.lifestyle_id) {
        console.log('  ⚠️ Skipping row - no lifestyle_id');
        continue;
      }
      
      // Remove null/empty values
      Object.keys(cleanRow).forEach(key => {
        if (cleanRow[key] === null || cleanRow[key] === undefined || cleanRow[key] === '') {
          delete cleanRow[key];
        }
      });
      
      const columns = Object.keys(cleanRow).join(', ');
      const placeholders = Object.keys(cleanRow).map(() => '?').join(', ');
      const values = Object.values(cleanRow);
      
      await connection.execute(
        `INSERT INTO tbl_lifestyle_detail (${columns}) VALUES (${placeholders})`,
        values
      );
      
      insertedCount++;
      console.log(`  ✅ Inserted detail with lifestyle_id: ${cleanRow.lifestyle_id}`);
    }
    
    await connection.query('COMMIT');
    await connection.end();
    
    console.log(`✅ Successfully inserted ${insertedCount} detail records`);
    
    res.json({
      success: true,
      message: `Successfully uploaded ${insertedCount} detail records`,
      inserted: insertedCount,
      step: 2,
      nextStep: 3
    });
    
  } catch (error) {
    console.error('❌ Error in Step 2:', error.message);
    if (connection) {
      try { await connection.query('ROLLBACK'); await connection.end(); } catch (e) {}
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// STEP 3: Upload tbl_lifestyle_rates and get lifestyle_rate_id
app.post('/api/lifestyle-step/upload-lifestyle-rates', singleFileUpload, async (req, res) => {
  console.log('\n========== STEP 3: Upload tbl_lifestyle_rates ==========');
  let connection = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const lifestyleId = req.body.lifestyle_id;
    console.log(`Using lifestyle_id from request: ${lifestyleId}`);
    
    const data = await parseExcelFromBuffer(req.file.buffer);
    console.log(`Parsed ${data.length} rate records`);
    
    if (data.length === 0) {
      return res.status(400).json({ success: false, message: 'Excel file is empty' });
    }
    
    connection = await mysql.createConnection(DB_CONFIG);
    await connection.query('START TRANSACTION');
    
    const insertedRateIds = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const cleanRow = { ...row };
      
      // Remove auto-increment and mapping columns
      delete cleanRow.lifestyle_rate_id;
      delete cleanRow.product_index;
      delete cleanRow.rate_index;
      
      // Use lifestyle_id from the Excel file if present, otherwise from request body
      if (!cleanRow.lifestyle_id && lifestyleId) {
        cleanRow.lifestyle_id = parseInt(lifestyleId);
      }
      
      if (!cleanRow.lifestyle_id) {
        console.log('  ⚠️ Skipping row - no lifestyle_id');
        continue;
      }
      
      // Remove null/empty values
      Object.keys(cleanRow).forEach(key => {
        if (cleanRow[key] === null || cleanRow[key] === undefined || cleanRow[key] === '') {
          delete cleanRow[key];
        }
      });
      
      const columns = Object.keys(cleanRow).join(', ');
      const placeholders = Object.keys(cleanRow).map(() => '?').join(', ');
      const values = Object.values(cleanRow);
      
      const [result] = await connection.execute(
        `INSERT INTO tbl_lifestyle_rates (${columns}) VALUES (${placeholders})`,
        values
      );
      
      insertedRateIds.push(result.insertId);
      console.log(`  ✅ Inserted rate row ${i + 1} -> lifestyle_rate_id: ${result.insertId}`);
    }
    
    await connection.query('COMMIT');
    await connection.end();
    
    console.log(`✅ Successfully inserted ${insertedRateIds.length} rate records`);
    console.log(`📋 Rate IDs: ${JSON.stringify(insertedRateIds)}`);
    
    res.json({
      success: true,
      message: `Successfully uploaded ${insertedRateIds.length} rate records`,
      rate_ids: insertedRateIds,
      rate_id: insertedRateIds[0], // Primary rate_id for single product
      lifestyle_rate_id: insertedRateIds[0],
      step: 3,
      nextStep: 4
    });
    
  } catch (error) {
    console.error('❌ Error in Step 3:', error.message);
    if (connection) {
      try { await connection.query('ROLLBACK'); await connection.end(); } catch (e) {}
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// STEP 4: Upload life_style_rates_packages with rate_id
app.post('/api/lifestyle-step/upload-rates-packages', singleFileUpload, async (req, res) => {
  console.log('\n========== STEP 4: Upload life_style_rates_packages ==========');
  let connection = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const rateId = req.body.rate_id;
    console.log(`Using rate_id from request: ${rateId}`);
    
    const data = await parseExcelFromBuffer(req.file.buffer);
    console.log(`Parsed ${data.length} package records`);
    
    if (data.length === 0) {
      return res.status(400).json({ success: false, message: 'Excel file is empty' });
    }
    
    connection = await mysql.createConnection(DB_CONFIG);
    await connection.query('START TRANSACTION');
    
    let insertedCount = 0;
    
    for (const row of data) {
      const cleanRow = { ...row };
      
      // Remove auto-increment and mapping columns
      delete cleanRow.id;
      delete cleanRow.product_index;
      delete cleanRow.rate_index;
      
      // Use rate_id from the Excel file if present, otherwise from request body
      if (!cleanRow.rate_id && rateId) {
        cleanRow.rate_id = parseInt(rateId);
      }
      
      if (!cleanRow.rate_id) {
        console.log('  ⚠️ Skipping row - no rate_id');
        continue;
      }
      
      // Remove null/empty values
      Object.keys(cleanRow).forEach(key => {
        if (cleanRow[key] === null || cleanRow[key] === undefined || cleanRow[key] === '') {
          delete cleanRow[key];
        }
      });
      
      const columns = Object.keys(cleanRow).join(', ');
      const placeholders = Object.keys(cleanRow).map(() => '?').join(', ');
      const values = Object.values(cleanRow);
      
      await connection.execute(
        `INSERT INTO life_style_rates_packages (${columns}) VALUES (${placeholders})`,
        values
      );
      
      insertedCount++;
      console.log(`  ✅ Inserted package with rate_id: ${cleanRow.rate_id}`);
    }
    
    await connection.query('COMMIT');
    await connection.end();
    
    console.log(`✅ Successfully inserted ${insertedCount} package records`);
    
    res.json({
      success: true,
      message: `Successfully uploaded ${insertedCount} package records`,
      inserted: insertedCount,
      step: 4,
      nextStep: 5
    });
    
  } catch (error) {
    console.error('❌ Error in Step 4:', error.message);
    if (connection) {
      try { await connection.query('ROLLBACK'); await connection.end(); } catch (e) {}
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// STEP 5: Upload tbl_lifestyle_inventory with lifestyle_id and rate_id
app.post('/api/lifestyle-step/upload-inventory', singleFileUpload, async (req, res) => {
  console.log('\n========== STEP 5: Upload tbl_lifestyle_inventory ==========');
  let connection = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const lifestyleId = req.body.lifestyle_id;
    const rateId = req.body.rate_id;
    console.log(`Using lifestyle_id: ${lifestyleId}, rate_id: ${rateId}`);
    
    const data = await parseExcelFromBuffer(req.file.buffer);
    console.log(`Parsed ${data.length} inventory records`);
    
    if (data.length === 0) {
      return res.status(400).json({ success: false, message: 'Excel file is empty' });
    }
    
    connection = await mysql.createConnection(DB_CONFIG);
    await connection.query('START TRANSACTION');
    
    let insertedCount = 0;
    const batchSize = 100;
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      for (const row of batch) {
        const cleanRow = { ...row };
        
        // Remove auto-increment and mapping columns
        delete cleanRow.lifestyle_inventory_id;
        delete cleanRow.product_index;
        delete cleanRow.rate_index;
        
        // Use IDs from the Excel file if present, otherwise from request body
        if (!cleanRow.lifestyle_id && lifestyleId) {
          cleanRow.lifestyle_id = parseInt(lifestyleId);
        }
        if (!cleanRow.rate_id && rateId) {
          cleanRow.rate_id = parseInt(rateId);
        }
        
        if (!cleanRow.lifestyle_id || !cleanRow.rate_id) {
          continue;
        }
        
        // Remove null/empty values
        Object.keys(cleanRow).forEach(key => {
          if (cleanRow[key] === null || cleanRow[key] === undefined || cleanRow[key] === '') {
            delete cleanRow[key];
          }
        });
        
        const columns = Object.keys(cleanRow).join(', ');
        const placeholders = Object.keys(cleanRow).map(() => '?').join(', ');
        const values = Object.values(cleanRow);
        
        await connection.execute(
          `INSERT INTO tbl_lifestyle_inventory (${columns}) VALUES (${placeholders})`,
          values
        );
        
        insertedCount++;
      }
      
      console.log(`  📦 Inserted batch ${Math.floor(i/batchSize) + 1} (${insertedCount}/${data.length})`);
    }
    
    await connection.query('COMMIT');
    await connection.end();
    
    console.log(`✅ Successfully inserted ${insertedCount} inventory records`);
    
    res.json({
      success: true,
      message: `Successfully uploaded ${insertedCount} inventory records`,
      inserted: insertedCount,
      step: 5,
      nextStep: 6
    });
    
  } catch (error) {
    console.error('❌ Error in Step 5:', error.message);
    if (connection) {
      try { await connection.query('ROLLBACK'); await connection.end(); } catch (e) {}
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// STEP 6: Upload tbl_lifestyle_terms_and_conditions with lifestyle_id
app.post('/api/lifestyle-step/upload-terms', singleFileUpload, async (req, res) => {
  console.log('\n========== STEP 6: Upload tbl_lifestyle_terms_and_conditions ==========');
  let connection = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const lifestyleId = req.body.lifestyle_id;
    console.log(`Using lifestyle_id from request: ${lifestyleId}`);
    
    const data = await parseExcelFromBuffer(req.file.buffer);
    console.log(`Parsed ${data.length} terms records`);
    
    if (data.length === 0) {
      return res.status(400).json({ success: false, message: 'Excel file is empty' });
    }
    
    connection = await mysql.createConnection(DB_CONFIG);
    await connection.query('START TRANSACTION');
    
    let insertedCount = 0;
    
    for (const row of data) {
      const cleanRow = { ...row };
      
      // Remove auto-increment and mapping columns
      delete cleanRow.termsncondition_id;
      delete cleanRow.product_index;
      delete cleanRow.rate_index;
      
      // Use lifestyle_id from the Excel file if present, otherwise from request body
      if (!cleanRow.lifestyle_id && lifestyleId) {
        cleanRow.lifestyle_id = parseInt(lifestyleId);
      }
      
      if (!cleanRow.lifestyle_id) {
        console.log('  ⚠️ Skipping row - no lifestyle_id');
        continue;
      }
      
      // Remove null/empty values
      Object.keys(cleanRow).forEach(key => {
        if (cleanRow[key] === null || cleanRow[key] === undefined || cleanRow[key] === '') {
          delete cleanRow[key];
        }
      });
      
      const columns = Object.keys(cleanRow).join(', ');
      const placeholders = Object.keys(cleanRow).map(() => '?').join(', ');
      const values = Object.values(cleanRow);
      
      await connection.execute(
        `INSERT INTO tbl_lifestyle_terms_and_conditions (${columns}) VALUES (${placeholders})`,
        values
      );
      
      insertedCount++;
      console.log(`  ✅ Inserted terms with lifestyle_id: ${cleanRow.lifestyle_id}`);
    }
    
    await connection.query('COMMIT');
    await connection.end();
    
    console.log(`✅ Successfully inserted ${insertedCount} terms records`);
    
    res.json({
      success: true,
      message: `Successfully uploaded ${insertedCount} terms records`,
      inserted: insertedCount,
      step: 6,
      nextStep: null,
      complete: true
    });
    
  } catch (error) {
    console.error('❌ Error in Step 6:', error.message);
    if (connection) {
      try { await connection.query('ROLLBACK'); await connection.end(); } catch (e) {}
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// API to regenerate Excel file with new IDs
app.post('/api/lifestyle-step/regenerate-excel', express.json(), async (req, res) => {
  console.log('\n========== Regenerate Excel with IDs ==========');
  
  try {
    const { tableType, lifestyleId, rateId, extractedData } = req.body;
    
    if (!tableType || !extractedData) {
      return res.status(400).json({ success: false, message: 'Missing tableType or extractedData' });
    }
    
    console.log(`Regenerating ${tableType} with lifestyle_id=${lifestyleId}, rate_id=${rateId}`);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(tableType);
    
    // Current timestamp
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const today = new Date().toISOString().slice(0, 10);
    
    let data = [];
    
    switch (tableType) {
      case 'tbl_lifestyle_detail':
        data = generateLifestyleDetailData(extractedData, lifestyleId, now);
        break;
      case 'tbl_lifestyle_rates':
        data = generateLifestyleRatesData(extractedData, lifestyleId, now, today);
        break;
      case 'life_style_rates_packages':
        data = generateRatesPackagesData(extractedData, rateId, now);
        break;
      case 'tbl_lifestyle_inventory':
        data = generateInventoryData(extractedData, lifestyleId, rateId, now, today);
        break;
      case 'tbl_lifestyle_terms_and_conditions':
        data = generateTermsData(extractedData, lifestyleId, now);
        break;
      default:
        return res.status(400).json({ success: false, message: `Unknown table type: ${tableType}` });
    }
    
    if (data.length === 0) {
      return res.status(400).json({ success: false, message: 'No data generated' });
    }
    
    // Add headers
    const headers = Object.keys(data[0]);
    worksheet.addRow(headers);
    
    // Add data rows
    data.forEach(row => {
      worksheet.addRow(Object.values(row));
    });
    
    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${tableType}.xlsx"`);
    res.send(buffer);
    
  } catch (error) {
    console.error('❌ Error regenerating Excel:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper functions for generating table data
function generateLifestyleDetailData(extractedData, lifestyleId, now) {
  const products = Array.isArray(extractedData) ? extractedData : [extractedData];
  return products.map((product, index) => {
    const features = product.features || [];
    return {
      lifestyle_id: lifestyleId,
      entrance: product.entrance || 'no',
      guide: product.guide || 'no',
      meal: product.meal || 'no',
      meal_transfer: product.meal_transfer || 'no',
      covid_safe: product.covid_safe || 'Yes',
      operating_dates: ',',
      operating_days: product.operating_days || null,
      opening_time: product.opening_time || '09:00:00',
      closing_time: product.closing_time || '18:00:00',
      closed_days: product.closed_days || null,
      closed_dates: product.closed_dates || null,
      created_at: now,
      updated_at: now,
      updated_by: product.vendor_id || 56,
      feature1: features[0] || null,
      feature2: features[1] || null,
      feature3: features[2] || null,
      feature4: features[3] || null,
      feature5: features[4] || null,
      feature6: features[5] || null,
      feature7: features[6] || null,
      feature8: features[7] || null,
      feature9: features[8] || null,
      feature10: features[9] || null,
      feature11: features[10] || null,
      feature12: features[11] || null,
      feature13: features[12] || null,
      feature14: features[13] || null,
      feature15: features[14] || null,
      feature16: features[15] || null,
      feature17: features[16] || null,
      feature18: features[17] || null,
      feature19: features[18] || null,
      deleted_at: null
    };
  });
}

function generateLifestyleRatesData(extractedData, lifestyleId, now, today) {
  const products = Array.isArray(extractedData) ? extractedData : [extractedData];
  return products.map(product => ({
    lifestyle_id: lifestyleId,
    booking_start_date: product.booking_start_date || today,
    booking_end_date: product.booking_end_date || '2026-12-31',
    travel_start_date: product.travel_start_date || today,
    travel_end_date: product.travel_end_date || '2026-12-31',
    attraction_category: product.attraction_category || null,
    meal_plan: product.meal_plan || null,
    market: product.market || 'All Market',
    currency: product.currency || 'LKR',
    adult_rate: parseFloat(product.adult_rate) || 0.00,
    child_rate: parseFloat(product.child_rate) || 0.00,
    student_rate: parseFloat(product.student_rate) || 0,
    senior_rate: parseFloat(product.senior_rate) || 0,
    military_rate: parseFloat(product.military_rate) || 0,
    other_rate: parseFloat(product.other_rate) || 0,
    child_foc_age: product.child_foc_age || '0-3',
    child_age: product.child_age || '5-11',
    adult_age: product.adult_age || '12-100',
    cwb_age: product.cwb_age || '0-0',
    cnb_age: product.cnb_age || '0-0',
    payment_policy: product.payment_policy || 'Full payment required at booking',
    book_by_days: product.book_by_days || 3,
    cancellation_days: product.cancellation_days || 1,
    cancel_policy: product.cancellation_policy || 'Free cancellation up to 24 hours before',
    stop_sales_Dates: null,
    blackout_days: product.blackout_days || null,
    blackout_dates: product.blackout_dates || null,
    created_at: now,
    updated_at: now,
    updated_by: product.vendor_id || 56,
    package_rate: parseFloat(product.package_rate) || 0,
    deleted_at: null,
    actual_adult_rate: parseFloat(product.actual_adult_rate) || parseFloat(product.adult_rate) || 0,
    actual_child_rate: parseFloat(product.actual_child_rate) || parseFloat(product.child_rate) || 0,
    actual_package_rate: parseFloat(product.actual_package_rate) || 0
  }));
}

function generateRatesPackagesData(extractedData, rateId, now) {
  const products = Array.isArray(extractedData) ? extractedData : [extractedData];
  return products.map(product => ({
    rate_id: rateId,
    min_adult_occupancy: parseInt(product.min_adult_occupancy) || 1,
    max_adult_occupancy: parseInt(product.max_adult_occupancy) || 10,
    min_child_occupancy: parseInt(product.min_child_occupancy) || 0,
    max_child_occupancy: parseInt(product.max_child_occupancy) || 0,
    total_occupancy: parseInt(product.total_occupancy) || 10,
    rate_type: product.rate_type || 'Per Person',
    package_rate: parseFloat(product.package_rate) || 0,
    adult_rate: parseFloat(product.adult_rate) || 0.00,
    child_rate: parseFloat(product.child_rate) || 0.00,
    package_name: product.package_name || 'Package Type',
    package_type: product.package_type || 'Per Person',
    package_selection: false,
    description: product.package_description || null,
    blocking_status: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    actual_package_rate: parseFloat(product.actual_package_rate) || 0,
    actual_adult_rate: parseFloat(product.actual_adult_rate) || parseFloat(product.adult_rate) || 0,
    actual_child_rate: parseFloat(product.actual_child_rate) || parseFloat(product.child_rate) || 0,
    status: 1
  }));
}

function generateInventoryData(extractedData, lifestyleId, rateId, now, today) {
  const products = Array.isArray(extractedData) ? extractedData : [extractedData];
  const allInventory = [];
  
  products.forEach(product => {
    const startDate = new Date();
    const pickupLocation = product.pickup_location || (product.city ? product.city + ', Sri Lanka' : null);
    const pickupTime = product.pickup_time || '09:00-18:00';
    const maxAdultOcc = parseInt(product.max_adult_occupancy) || 1;
    const maxChildOcc = parseInt(product.max_child_occupancy) || 2;
    const maxTotalOcc = parseInt(product.total_occupancy) || 6;
    const totalInventory = parseInt(product.total_inventory) || 20;
    const allotment = parseInt(product.allotment) || 20;
    const invLongitude = parseFloat(product.longitude) || null;
    const invLatitude = parseFloat(product.latitude) || null;

    for (let i = 0; i < 210; i++) {
      const inventoryDate = new Date(startDate);
      inventoryDate.setDate(startDate.getDate() + i);
      const dateStr = inventoryDate.toISOString().slice(0, 10);
      
      allInventory.push({
        lifestyle_id: lifestyleId,
        rate_id: rateId,
        pickup_location: pickupLocation,
        inventory_date: dateStr,
        pickup_time: pickupTime,
        max_adult_occupancy: maxAdultOcc,
        max_children_occupancy: maxChildOcc,
        max_total_occupancy: maxTotalOcc,
        total_inventory: totalInventory,
        allotment: allotment,
        used: 0,
        balance: allotment,
        vehicle_type: product.vehicle_type || null,
        inclusions: product.inclusions || null,
        exclusions: product.exclusions || null,
        longitude: invLongitude,
        latitude: invLatitude,
        updated_at: now,
        inventory_deadline: today,
        deleted_at: null
      });
    }
  });
  
  return allInventory;
}

function generateTermsData(extractedData, lifestyleId, now) {
  const products = Array.isArray(extractedData) ? extractedData : [extractedData];
  const defaultTerms = 'Services are provided by appointment only and are subject to availability.';
  
  return products.map(product => ({
    lifestyle_id: lifestyleId,
    general_tnc: product.general_terms_and_conditions || defaultTerms,
    cancel_policy: product.cancellation_policy || 'Free cancellation up to 24 hours before',
    created_at: now,
    updated_at: now,
    updated_by: product.vendor_id || 56,
    deleted_at: null
  }));
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Upload directory: ${uploadDir}`);
  console.log(`Output directory: ${outputDir}`);
});