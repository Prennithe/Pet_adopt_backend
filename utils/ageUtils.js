// Age utility functions for pet age management

/**
 * Formats age object to display string
 * @param {Object} age - { years, months, days }
 * @returns {string} Formatted age string
 */
const formatAge = (age) => {
  if (!age) return 'Unknown';

  const parts = [];
  if (age.years > 0) parts.push(`${age.years} year${age.years !== 1 ? 's' : ''}`);
  if (age.months > 0) parts.push(`${age.months} month${age.months !== 1 ? 's' : ''}`);
  if (age.days > 0) parts.push(`${age.days} day${age.days !== 1 ? 's' : ''}`);

  return parts.length > 0 ? parts.join(' ') : 'Less than 1 day';
};

/**
 * Normalizes age object by converting excess days/months to appropriate units
 * @param {Object} age - { years, months, days }
 * @returns {Object} Normalized age object
 */
const normalizeAge = (age) => {
  let { years = 0, months = 0, days = 0 } = age;

  // Convert excess days to months (30 days = 1 month)
  if (days >= 30) {
    const extraMonths = Math.floor(days / 30);
    months += extraMonths;
    days = days % 30;
  }

  // Convert excess months to years (12 months = 1 year)
  if (months >= 12) {
    const extraYears = Math.floor(months / 12);
    years += extraYears;
    months = months % 12;
  }

  // Ensure constraints
  months = Math.min(months, 11);
  days = Math.min(days, 29);

  return { years, months, days };
};

/**
 * Parses text input like "1 year 3 months" into structured age object
 * @param {string} text - Age text to parse
 * @returns {Object|null} Parsed age object or null if invalid
 */
const parseAgeText = (text) => {
  if (!text || typeof text !== 'string') return null;

  const age = { years: 0, months: 0, days: 0 };

  // Match patterns like "1 year", "2 months", "3 days"
  const patterns = [
    /(\d+)\s*(?:year|yr)s?\b/gi,
    /(\d+)\s*(?:month|mo)s?\b/gi,
    /(\d+)\s*(?:day|d)s?\b/gi
  ];

  const matches = text.match(/\d+\s*(?:year|yr|month|mo|day|d)s?\b/gi) || [];

  matches.forEach(match => {
    const num = parseInt(match.match(/\d+/)[0]);
    if (match.toLowerCase().includes('year') || match.toLowerCase().includes('yr')) {
      age.years = num;
    } else if (match.toLowerCase().includes('month') || match.toLowerCase().includes('mo')) {
      age.months = num;
    } else if (match.toLowerCase().includes('day') || match.toLowerCase().includes('d')) {
      age.days = num;
    }
  });

  return normalizeAge(age);
};

/**
 * Converts legacy number age to structured age object
 * @param {number} years - Age in years
 * @returns {Object} Structured age object
 */
const convertLegacyAge = (years) => {
  return normalizeAge({ years: Math.floor(years), months: 0, days: 0 });
};

module.exports = {
  formatAge,
  normalizeAge,
  parseAgeText,
  convertLegacyAge
};