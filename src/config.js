// ============================================================
//  BG INDIA PORTAL — CENTRAL CONFIGURATION
//  All property-specific values live here.
//  PINs are loaded from environment variables (never in code).
//  To white-label for another tenant: change this file only.
// ============================================================

export const CONFIG = {
  // Branding
  brandName:  'Guruvayur Estates',
  brandShort: 'GE Portal',
  tagline:    'Property Management Portal',

  // Google integration
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbzpW7u02Ss_uUkd7539Ja2RrjzanBrIWIfC8b6Q9wCZa7X4xDLjWHnJiRmr7m9VE1DK/exec',
  driveRootId:   '1Qyy37HJVo4RQ5MPVmSJt26-SkE65sFva',
  ownerEmail:    'bijisukumar@gmail.com',
  spreadsheetId:    '1xpLBxd2Fhx26aNQZ3Z5L4gDB6yJVFsGHf3B1jUDkvQQ',  // add this
  guestFormSheetId: '1Lt1aORPlrisE_4-DobQCecvlyH0yOsD2SAIgJLgyEo0',


  // Villa properties — add more objects here for additional villas
  // logoUrl: per-villa logo for white-labeling (null = use default)
  villas: [
    {
      id:       'dwarka',
      name:     'Dwarka',
      full:     'Dwarka — GVR Villa',
      location: 'Guruvayur',
      active:   true,
      logoUrl:  null,   // set to '/icons/dwarka-logo.png' or CDN URL to brand this villa
    }
  ],

  // Rental properties — monthly income tracker
  // tenantName and leaseEnd are now managed via the Tenant Agreements screen (/owner/rental/agreement)
  // and stored in the rental_props table. The fields below are fallbacks for display only.
  // Add leaseEnd (YYYY-MM-DD) here to enable renewal alerts (60-day warning) as a quick override.
  rentalProperties: [
    { id: 'rental_1', name: 'Tritvam',  location: 'Kochi, KL',  tenantName: '', leaseEnd: '' },
    { id: 'rental_2', name: 'Pacifica', location: 'OMR, TN',    tenantName: '', leaseEnd: '' },
    { id: 'rental_3', name: 'Pinnacle', location: 'TCR, KL',    tenantName: '', leaseEnd: '' },
  ],

  // Estate properties
  estates: [
    { id: 'pollachi',   name: 'Pollachi Estate',   type: 'coconut', manager: 'Pradosh',      active: true },
    { id: 'pavutumuri', name: 'Pavutumuri Estate',  type: 'rubber',  manager: 'RamananKutty', active: true },
  ],

  // Pricing defaults
  breakfastRate:       275,   // ₹ per person per day
  additionalGuestRate: 750,   // ₹ per night
  dehuskDefaultRate:   1.50,  // ₹ per coconut

  // Theme colours
  theme: {
    gold:      '#C8903A',
    goldLight: '#F0D080',
    dark:      '#1A1A1A',
    darkCard:  '#242B3D',
    darkNav:   '#1E2535',
    text:      '#EDF2F7',
    textMuted: '#8A9BAE',
    textDim:   '#5C7080',
    green:     '#34A853',
    red:       '#c62828',
    blue:      '#185FA5',
    teal:      '#0F6E56',
  }
}
