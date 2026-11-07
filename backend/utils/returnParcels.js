'use strict';

/*
  Decides whether a Shiprocket status means the parcel did not reach
  the customer. Used by the admin "Return Parcels" page.

  kinds:
    undelivered  - courier could not hand it over (customer not found...)
    returning    - on its way back to the shop (RTO)
    returned     - back at the shop (RTO delivered)
    lost         - lost or damaged
*/

const PROBLEM_REGEX =
  /rto|return|undeliver|not delivered|delivery (failed|attempt)|lost|damag|destroy|misroute|untraceable/i;

const KINDS = {
  undelivered: 'Undelivered (customer not found)',
  returning: 'Returning to you (RTO)',
  returned: 'Returned to you',
  lost: 'Lost or damaged'
};

function classifyParcelStatus(status) {
  const text = String(status || '').trim();

  if (!text || !PROBLEM_REGEX.test(text)) {
    return null;
  }

  if (/lost|damag|destroy|untraceable|misroute/i.test(text)) {
    return 'lost';
  }

  if (/rto/i.test(text) && /delivered|received/i.test(text)) {
    return 'returned';
  }

  if (/rto|return/i.test(text)) {
    return 'returning';
  }

  return 'undelivered';
}

module.exports = {
  PROBLEM_REGEX,
  KINDS,
  classifyParcelStatus
};
