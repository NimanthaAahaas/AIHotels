// Parse AI extracted data for hotel contracts
// First, strip any markdown code blocks if present
let rawContent = $input.first().json.message.content;
if (typeof rawContent === 'string') {
  rawContent = rawContent.trim();
  // Remove markdown code blocks
  if (rawContent.startsWith('```json')) {
    rawContent = rawContent.slice(7);
  } else if (rawContent.startsWith('```')) {
    rawContent = rawContent.slice(3);
  }
  if (rawContent.endsWith('```')) {
    rawContent = rawContent.slice(0, -3);
  }
  rawContent = rawContent.trim();
}
const parsedData = JSON.parse(rawContent);

// Current timestamp
const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
const today = new Date().toISOString().slice(0, 10);

// Calculate end date (360 days from today)
const endDate = new Date();
endDate.setDate(endDate.getDate() + 360);
const inventoryEndDate = endDate.toISOString().slice(0, 10);

// Extract hotel data
const hotelData = parsedData.hotel || {};
const hotelDetailsData = parsedData.hotel_details || {};
const roomCategories = parsedData.hotel_room_categories || [];
const roomTypes = parsedData.hotel_room_types || [];
const roomRatesFromAI = parsedData.hotel_room_rates || [];
const termsConditions = parsedData.hotel_terms_conditions || {};
const roomInventories = parsedData.hotel_room_inventories || [];

// Extract unique meal plans from AI data (default to ['BB'] if not found)
const mealPlansSet = new Set();
roomRatesFromAI.forEach(rate => {
  if (rate.meal_plan) {
    // Handle both single meal plan and comma-separated meal plans
    const plans = String(rate.meal_plan).split(',').map(p => p.trim().toUpperCase());
    plans.forEach(p => mealPlansSet.add(p));
  }
});
const mealPlans = mealPlansSet.size > 0 ? Array.from(mealPlansSet) : ['BB'];

// Extract unique date periods from AI data
const datePeriodsMap = new Map();
roomRatesFromAI.forEach(rate => {
  const key = `${rate.booking_start_date}_${rate.booking_end_date}`;
  if (rate.booking_start_date && rate.booking_end_date && !datePeriodsMap.has(key)) {
    datePeriodsMap.set(key, {
      start: rate.booking_start_date,
      end: rate.booking_end_date
    });
  }
});
const datePeriods = Array.from(datePeriodsMap.values());

// Extract unique room types (default to Single and Double)
const roomTypesSet = new Set();
roomRatesFromAI.forEach(rate => {
  if (rate.room_type_id) roomTypesSet.add(rate.room_type_id);
});
if (roomTypesSet.size === 0) {
  roomTypesSet.add('Single');
  roomTypesSet.add('Double');
}
const roomTypesList = Array.from(roomTypesSet);

// Create a lookup map for rates: key = "period_category_mealPlan" -> rate data
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

// Generate complete room rates with all combinations
// Format: For each period, for each room category, for each room type, for each meal plan
const roomRates = [];
let cardId = 100; // Starting card_id from 100

// Sort periods by start date
datePeriods.sort((a, b) => a.start.localeCompare(b.start));

// Get list of room category names
const categoryNames = roomCategories.map(cat => cat.room_category_name).filter(n => n);

// If no categories from AI, try to extract from rates
if (categoryNames.length === 0) {
  const catSet = new Set();
  roomRatesFromAI.forEach(rate => {
    if (rate.room_category_id) catSet.add(rate.room_category_id);
  });
  catSet.forEach(cat => categoryNames.push(cat));
}

// Generate rates for each combination
for (const period of datePeriods) {
  for (const mealPlan of mealPlans) {
    for (const category of categoryNames) {
      // Get rate data for this period/category/mealPlan combination
      const lookupKey = `${period.start}_${period.end}_${category}_${mealPlan}`;
      const rateData = ratesLookup.get(lookupKey) || roomRatesFromAI.find(r => 
        r.room_category_id === category && 
        r.booking_start_date === period.start && 
        r.booking_end_date === period.end
      ) || roomRatesFromAI.find(r => r.room_category_id === category) || {};
      
      const currentCardId = cardId;
      
      // Create entry for each room type (Single, Double) with SAME card_id
      for (const roomType of roomTypesList) {
        roomRates.push({
          room_category_id: category,
          room_type_id: roomType,
          booking_start_date: period.start,
          booking_end_date: period.end,
          meal_plan: mealPlan,
          market_nationality: rateData.market_nationality || 'All',
          currency: rateData.currency || 'USD',
          adult_rate: parseFloat(rateData.adult_rate) || 0,
          child_with_bed_rate: parseFloat(rateData.child_with_bed_rate) || 0,
          child_without_bed_rate: parseFloat(rateData.child_without_bed_rate) || 0,
          child_foc_age: rateData.child_foc_age || '0-6',
          child_with_no_bed_age: rateData.child_with_no_bed_age || '6-11.99',
          child_with_bed_age: rateData.child_with_bed_age || '6-11.99',
          adult_age: rateData.adult_age || '12+',
          book_by_days: parseInt(rateData.book_by_days) || 0,
          payment_type: rateData.payment_type || 'Advance',
          blackout_dates: rateData.blackout_dates || '',
          blackout_days: rateData.blackout_days || '',
          card_id: currentCardId,
          actual_adult_rate: parseFloat(rateData.actual_adult_rate) || parseFloat(rateData.adult_rate) || 0,
          actual_child_with_bed_rate: parseFloat(rateData.actual_child_with_bed_rate) || parseFloat(rateData.child_with_bed_rate) || 0,
          actual_child_without_bed_rate: parseFloat(rateData.actual_child_without_bed_rate) || parseFloat(rateData.child_without_bed_rate) || 0,
          min_adult_occupancy: parseInt(rateData.min_adult_occupancy) || 1,
          max_adult_occupancy: parseInt(rateData.max_adult_occupancy) || 2,
          min_child_occupancy: parseInt(rateData.min_child_occupancy) || 0,
          max_child_occupancy: parseInt(rateData.max_child_occupancy) || 2,
          total_occupancy: parseInt(rateData.total_occupancy) || 3
        });
      }
      
      // Increment card_id for next room category (same card_id was used for both Single and Double)
      cardId++;
    }
  }
}

// TABLE 1: hotels
const hotels_table = [{
  id: '',
  hotel_name: hotelData.hotel_name || 'Unknown Hotel',
  hotel_description: hotelData.hotel_description || '',
  star_classification: hotelData.star_classification || '',
  auto_confirmation: hotelData.auto_confirmation || 0,
  triggers: hotelData.triggers || 0,
  hotel_classification: hotelData.hotel_classification || '',
  longitude: hotelData.longitude || '',
  latitude: hotelData.latitude || '',
  provider: hotelData.provider || '',
  hotel_address: hotelData.hotel_address || '',
  trip_advisor_link: hotelData.trip_advisor_link || '',
  hotel_image: hotelData.hotel_image || '',
  country: hotelData.country || 'LK',
  city: hotelData.city || '',
  micro_location: hotelData.micro_location || hotelData.city || '',
  hotel_status: hotelData.hotel_status || '1',
  start_date: hotelData.start_date || today,
  end_date: hotelData.end_date || inventoryEndDate,
  vendor_id: hotelData.vendor_id || '',
  updated_by: '',
  created_at: now,
  updated_at: now,
  additional_data_1: hotelData.additional_data_1 || 'USD',
  markup: hotelData.markup || 3,
  sub_description: hotelData.sub_description || '',
  deleted_at: null,
  temp_column: ''
}];

// TABLE 2: hotel_details
const hotel_details_table = [{
  id: '',
  hotel_id: '',
  driver_accomadation: hotelDetailsData.driver_accomadation || 'no',
  lift_status: hotelDetailsData.lift_status || 'no',
  vehicle_approchable: hotelDetailsData.vehicle_approchable || 'yes',
  ac_status: hotelDetailsData.ac_status || 'yes',
  covid_safe: hotelDetailsData.covid_safe || 'yes',
  feature1: hotelDetailsData.feature1 || '',
  feature2: hotelDetailsData.feature2 || '',
  feature3: hotelDetailsData.feature3 || '',
  feature4: hotelDetailsData.feature4 || '',
  preferred: hotelDetailsData.preferred || 'no',
  updated_by: '',
  created_at: now,
  updated_at: now,
  hotel_detailscol: '',
  deleted_at: null
}];

// TABLE 3: hotel_room_categories
const hotel_room_categories_table = roomCategories.length > 0 
  ? roomCategories.map((cat) => ({
      id: '',
      hotel_id: '',
      room_category_name: cat.room_category_name || '',
      created_at: now,
      updated_at: now,
      deleted_at: null
    }))
  : [{ id: '', hotel_id: '', room_category_name: '', created_at: now, updated_at: now, deleted_at: null }];

// TABLE 4: hotel_room_types
const hotel_room_types_table = roomTypes.length > 0
  ? roomTypes.map((type) => ({
      id: '',
      hotel_id: '',
      room_category_type: type.room_category_type || '',
      created_at: now,
      updated_at: now,
      deleted_at: null
    }))
  : [{ id: '', hotel_id: '', room_category_type: '', created_at: now, updated_at: now, deleted_at: null }];

// TABLE 5: hotel_room_rates
// This should have MULTIPLE rows - one for each (period × room_category × room_type × meal_plan) combination
// card_id starts from 100, same card_id for same room category in same period (both Single and Double)
const hotel_room_rates_table = roomRates.length > 0
  ? roomRates.map((rate, index) => ({
      id: '',
      hotel_id: '',
      market_nationality: rate.market_nationality || 'All',
      currency: rate.currency || 'USD',
      adult_rate: parseFloat(rate.adult_rate) || 0,
      child_with_bed_rate: parseFloat(rate.child_with_bed_rate) || 0,
      child_without_bed_rate: parseFloat(rate.child_without_bed_rate) || 0,
      child_foc_age: rate.child_foc_age || '0-6',
      child_with_no_bed_age: rate.child_with_no_bed_age || '6-11.99',
      child_with_bed_age: rate.child_with_bed_age || '6-11.99',
      adult_age: rate.adult_age || '12+',
      book_by_days: parseInt(rate.book_by_days) || 0,
      meal_plan: rate.meal_plan || 'BB',
      room_category_id: rate.room_category_id || '',
      room_type_id: rate.room_type_id || '',
      booking_start_date: rate.booking_start_date || today,
      booking_end_date: rate.booking_end_date || inventoryEndDate,
      payment_type: rate.payment_type || 'Advance',
      blackout_dates: rate.blackout_dates || '',
      blackout_days: rate.blackout_days || '',
      created_at: now,
      updated_at: now,
      card_id: rate.card_id || (100 + index),
      deleted_at: null,
      actual_adult_rate: parseFloat(rate.actual_adult_rate) || parseFloat(rate.adult_rate) || 0,
      actual_child_with_bed_rate: parseFloat(rate.actual_child_with_bed_rate) || parseFloat(rate.child_with_bed_rate) || 0,
      actual_child_without_bed_rate: parseFloat(rate.actual_child_without_bed_rate) || parseFloat(rate.child_without_bed_rate) || 0,
      min_adult_occupancy: parseInt(rate.min_adult_occupancy) || 1,
      max_adult_occupancy: parseInt(rate.max_adult_occupancy) || 2,
      min_child_occupancy: parseInt(rate.min_child_occupancy) || 0,
      max_child_occupancy: parseInt(rate.max_child_occupancy) || 2,
      total_occupancy: parseInt(rate.total_occupancy) || 3
    }))
  : [{
      id: '', hotel_id: '', market_nationality: 'All', currency: 'USD', adult_rate: 0,
      child_with_bed_rate: 0, child_without_bed_rate: 0, child_foc_age: '0-6',
      child_with_no_bed_age: '6-11.99', child_with_bed_age: '6-11.99', adult_age: '12+',
      book_by_days: 0, meal_plan: 'BB', room_category_id: '', room_type_id: '',
      booking_start_date: today, booking_end_date: inventoryEndDate, payment_type: 'Advance',
      blackout_dates: '', blackout_days: '', created_at: now, updated_at: now, card_id: 100,
      deleted_at: null, actual_adult_rate: 0, actual_child_with_bed_rate: 0,
      actual_child_without_bed_rate: 0, min_adult_occupancy: 1, max_adult_occupancy: 2,
      min_child_occupancy: 0, max_child_occupancy: 2, total_occupancy: 3
    }];

// TABLE 6: hotel_terms_conditions
const hotel_terms_conditions_table = [{
  id: '',
  hotel_id: '',
  general_tc: termsConditions.general_tc || '',
  cancellation_policy: termsConditions.cancellation_policy || '',
  cancellation_deadline: termsConditions.cancellation_deadline || '',
  updated_by: '',
  created_at: now,
  updated_at: now,
  deleted_at: null
}];

// TABLE 7: hotel_room_inventories
// One inventory entry per rate entry (same as hotel_room_rates)
const hotel_room_inventories_table = roomRates.length > 0
  ? roomRates.map((rate) => ({
      id: '',
      rate_id: '',  // Will match hotel_room_rates.id
      booking_start_date: rate.booking_start_date || today,
      booking_end_date: rate.booking_end_date || inventoryEndDate,
      allotment: 10,
      stop_sale_date: '',
      created_at: now,
      updated_at: now,
      deleted_at: null
    }))
  : [{
      id: '', rate_id: '', booking_start_date: today, booking_end_date: inventoryEndDate,
      allotment: 10, stop_sale_date: '', created_at: now, updated_at: now, deleted_at: null
    }];

// ============================================================
// TABLE 8: hotel_room_daily_inventories
// Generate ONE record per room_category per date
// Covers ALL date periods from the rates
// ============================================================
const hotel_room_daily_inventories_table = [];

// Helper function to parse date string
function parseContractDate(dateStr) {
  if (!dateStr) return null;
  dateStr = String(dateStr).trim();
  
  // Handle DD.MM.YY or DD.MM.YYYY format
  if (dateStr.includes('.')) {
    const parts = dateStr.split('.');
    if (parts.length === 3) {
      let day = parseInt(parts[0]);
      let month = parseInt(parts[1]) - 1;
      let year = parseInt(parts[2]);
      if (year < 100) year += 2000;
      return new Date(year, month, day);
    }
  }
  
  // Handle YYYY-MM-DD format
  if (dateStr.includes('-')) {
    return new Date(dateStr + 'T00:00:00');
  }
  
  return new Date(dateStr);
}

// Helper function to get all dates between two dates
function getDatesBetween(startDate, endDate) {
  const dates = [];
  let currentDate = new Date(startDate);
  const end = new Date(endDate);
  
  while (currentDate <= end) {
    dates.push(currentDate.toISOString().slice(0, 10));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return dates;
}

// Group room rates by room_category_id to get date ranges per category
const categoryDateRanges = {};

if (roomRates.length > 0) {
  roomRates.forEach(rate => {
    const categoryName = rate.room_category_id || '';
    const startDateStr = rate.booking_start_date;
    const endDateStr = rate.booking_end_date;
    
    if (categoryName && startDateStr && endDateStr) {
      if (!categoryDateRanges[categoryName]) {
        categoryDateRanges[categoryName] = [];
      }
      
      const periodKey = startDateStr + '_' + endDateStr;
      // Avoid duplicates
      if (!categoryDateRanges[categoryName].find(p => p.key === periodKey)) {
        categoryDateRanges[categoryName].push({
          key: periodKey,
          start: parseContractDate(startDateStr),
          end: parseContractDate(endDateStr)
        });
      }
    }
  });
}

// If no rates found, use room categories with hotel contract dates
if (Object.keys(categoryDateRanges).length === 0 && roomCategories.length > 0) {
  const contractStart = parseContractDate(hotelData.start_date) || new Date();
  const contractEnd = parseContractDate(hotelData.end_date) || new Date(new Date().setDate(new Date().getDate() + 180));
  
  roomCategories.forEach(cat => {
    const categoryName = cat.room_category_name || '';
    if (categoryName) {
      categoryDateRanges[categoryName] = [{
        key: 'default',
        start: contractStart,
        end: contractEnd
      }];
    }
  });
}

// Default values
const defaultInventoryId = 0;
const defaultDailyAllotment = 5;
const defaultUsed = 0;
const defaultBalance = 5;

// Generate daily inventory for each category and each day in its date periods
for (const categoryName of Object.keys(categoryDateRanges)) {
  const periods = categoryDateRanges[categoryName];
  
  for (const period of periods) {
    if (period.start && period.end && !isNaN(period.start.getTime()) && !isNaN(period.end.getTime())) {
      const allDates = getDatesBetween(period.start, period.end);
      
      for (const dateStr of allDates) {
        hotel_room_daily_inventories_table.push({
          id: '',
          hotel_id: '',
          inventory_id: defaultInventoryId,
          room_category_id: categoryName,
          date: dateStr,
          daily_allotment: defaultDailyAllotment,
          used: defaultUsed,
          balance: defaultBalance,
          created_at: now,
          updated_at: now,
          deleted_at: null
        });
      }
    }
  }
}

// Return all tables
return [{
  json: {
    extracted_raw_data: parsedData,
    tables: {
      hotels: hotels_table,
      hotel_details: hotel_details_table,
      hotel_room_categories: hotel_room_categories_table,
      hotel_room_types: hotel_room_types_table,
      hotel_room_rates: hotel_room_rates_table,
      hotel_terms_conditions: hotel_terms_conditions_table,
      hotel_room_inventories: hotel_room_inventories_table,
      hotel_room_daily_inventories: hotel_room_daily_inventories_table
    }
  }
}];
