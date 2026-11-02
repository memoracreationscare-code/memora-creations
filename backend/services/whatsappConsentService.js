
'use strict';

/*
=========================================
 MEMORA CREATIONS
 WHATSAPP CUSTOMER CONSENT SERVICE

 Secure, explicit consent handling.

 Customer must actively select
 the WhatsApp opt-in checkbox.

 Default: NOT OPTED IN
=========================================
*/

const DISCLOSURE_VERSION = '2026-11-02-v1';

/*
=========================================
 BUILD CONSENT SNAPSHOT
=========================================
*/

function buildWhatsAppConsent({
  optedIn = false,
  source = 'CHECKOUT'
} = {}) {

  /*
    Accept only the actual
    boolean true.

    Do not accept strings such as
    "true", "yes" or "1".
  */

  const permissionGranted =
    optedIn === true;

  if (!permissionGranted) {
    return {
      optedIn: false,
      optedInAt: null,
      source: 'NONE',
      disclosureVersion: null
    };
  }

  /*
    Only supported consent sources.
  */

  const allowedSources = [
    'CHECKOUT',
    'ACCOUNT'
  ];

  if (!allowedSources.includes(source)) {
    return {
      optedIn: false,
      optedInAt: null,
      source: 'NONE',
      disclosureVersion: null
    };
  }

  return {
    optedIn: true,
    optedInAt: new Date(),
    source,
    disclosureVersion:
      DISCLOSURE_VERSION
  };
}


/*
=========================================
 CHECK RECORDED CONSENT
=========================================
*/

function hasWhatsAppConsent(order) {

  if (!order) {
    return false;
  }

  const consent = order.whatsappConsent;

  if (!consent) {
    return false;
  }

  if (consent.optedIn !== true) {
    return false;
  }

  if (!consent.optedInAt) {
    return false;
  }

  if (
    !['CHECKOUT', 'ACCOUNT']
      .includes(consent.source)
  ) {
    return false;
  }

  if (!consent.disclosureVersion) {
    return false;
  }

  return true;
}


/*
=========================================
 EXPORTS
=========================================
*/

module.exports = {
  DISCLOSURE_VERSION,
  buildWhatsAppConsent,
  hasWhatsAppConsent
};
