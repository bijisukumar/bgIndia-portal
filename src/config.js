// ============================================================
//  BG INDIA PORTAL — CENTRAL CONFIGURATION
//  All property-specific values live here.
//  To white-label for another tenant: change this file only.
// ============================================================

export const CONFIG = {
  // Branding
  brandName:     'Guruvayur Estates',
  brandShort:    'GE Portal',
  tagline:       'Property Management Portal',

  // Google integration
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbzIIuiPmTZM6jmPVIERI8Pxef3-bg7q4djuojvQpJ_JwMq-sW1R6vMl84d7rkkJMyiN/exec',
  driveRootId:   '1Qyy37HJVo4RQ5MPVmSJt26-SkE65sFva',
  ownerEmail:    'bijisukumar@gmail.com',

  // Villa properties — add more objects here for second villa
  villas: [
    {
      id:     'dwarka',
      name:   'Dvaraka',
      full:   'Dvaraka — GVR Villa',
      location: 'Guruvayur',
      active: true,
    }
  ],

  // Rental properties — monthly income tracker
  rentalProperties: [
    { id: 'rental_1', name: 'Property A', location: '' },
    { id: 'rental_2', name: 'Property B', location: '' },
    { id: 'rental_3', name: 'Property C', location: '' },
  ],

  // Estate properties
  estates: [
    {
      id:       'pollachi',
      name:     'Pollachi Estate',
      type:     'coconut',
      manager:  'Pradosh',
      active:   true,
    },
    {
      id:       'pavutumuri',
      name:     'Pavutumuri Estate',
      type:     'rubber',
      manager:  'RamananKutty',
      active:   true,
    }
  ],

  // Pricing defaults
  breakfastRate:       275,   // ₹ per person per day
  additionalGuestRate: 750,   // ₹ per night (drivers, nannies etc.)

  // Dehusk default rate — editable per harvest entry
  dehuskDefaultRate: 1.50,    // ₹ per coconut

  // ============================================================
  //  USER ACCESS CONTROL
  //  Each user has a PIN and a list of screen IDs they can access.
  //  screenIds must match keys in SCREENS below.
  // ============================================================
  users: {
    '303': {
      name:    'Owner',
      role:    'owner',
      screens: ['owner_home'],   // owner_home shows everything
    },
    '1111': {
      name:    'RamananKutty',
      role:    'manager',
      screens: ['raman_home'],
    },
    '2222': {
      name:    'Pradosh',
      role:    'estate_manager',
      screens: ['pradosh_home'],
    },
  },

  // Theme colours — matches the gold/dark GVR aesthetic
  theme: {
    gold:     '#C8903A',
    goldLight:'#F0D080',
    dark:     '#1A1A1A',
    darkCard: '#242B3D',
    darkNav:  '#1E2535',
    text:     '#EDF2F7',
    textMuted:'#8A9BAE',
    textDim:  '#5C7080',
    green:    '#34A853',
    red:      '#c62828',
    blue:     '#185FA5',
    teal:     '#0F6E56',
  }
}
