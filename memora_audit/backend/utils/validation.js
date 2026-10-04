const validator = require('validator');

const mobileRegex = /^[6-9]\d{9}$/;
const pinRegex = /^\d{6}$/;

function cleanString(value, max = 5000) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function validMobile(value) { return mobileRegex.test(String(value || '').trim()); }
function validPin(value) { return pinRegex.test(String(value || '').trim()); }
function validEmail(value) { return !value || validator.isEmail(String(value).trim()); }
function positiveInt(value) { return Number.isInteger(Number(value)) && Number(value) > 0; }
function nonNegativeNumber(value) { return Number.isFinite(Number(value)) && Number(value) >= 0; }

function validateAddress(address) {
  if (!address || !cleanString(address.fullName, 100) || !validMobile(address.mobile) || !cleanString(address.addressLine, 300) || !validPin(address.pinCode)) {
    return 'Please provide a valid name, mobile number, complete address and 6-digit PIN code.';
  }
  return null;
}

module.exports = { cleanString, validMobile, validPin, validEmail, positiveInt, nonNegativeNumber, validateAddress };
