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
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbwbhbgGJPsYJL2JlNuYoYpL8fy2rCmeTrF-aYarbDkJU3d6FzHclXCXDzkem__8LOCQ/exec',
  driveRootId:   '1Qyy37HJVo4RQ5MPVmSJt26-SkE65sFva',
  ownerEmail:    'bijisukumar@gmail.com',
  spreadsheetId:    '1xpLBxd2Fhx26aNQZ3Z5L4gDB6yJVFsGHf3B1jUDkvQQ',  // add this
  guestFormSheetId: '1Lt1aORPlrisE_4-DobQCecvlyH0yOsD2SAIgJLgyEo0',


  // Villa properties — add more objects here for second villa
  villas: [
    {
      id:       'dwarka',
      name:     'Dwarka',
      full:     'Dwarka — GVR Villa',
      location: 'Guruvayur',
      active:   true,
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
    { id: 'pollachi',   name: 'Pollachi Estate',   type: 'coconut', manager: 'Pradosh',      active: true },
    { id: 'pavutumuri', name: 'Pavutumuri Estate',  type: 'rubber',  manager: 'RamananKutty', active: true },
  ],

  // Pricing defaults
  breakfastRate:       275,   // ₹ per person per day
  additionalGuestRate: 750,   // ₹ per night
  dehuskDefaultRate:   1.50,  // ₹ per coconut

  // ── USER ACCESS CONTROL ──────────────────────────────────
  //  PINs are loaded from Vite environment variables.
  //  Set these in Cloudflare Pages → Settings → Environment variables:
  //    VITE_PIN_OWNER   = your owner PIN
  //    VITE_PIN_RAMAN   = Raman's PIN
  //    VITE_PIN_PRADOSH = Pradosh's PIN
  //  For local dev, set them in .env.local (never commit that file)
  // ─────────────────────────────────────────────────────────
  users: {
    [import.meta.env.VITE_PIN_OWNER]:   { name: 'Owner',        role: 'owner'          },
    [import.meta.env.VITE_PIN_RAMAN]:   { name: 'RamananKutty', role: 'manager'         },
    [import.meta.env.VITE_PIN_PRADOSH]: { name: 'Pradosh',      role: 'estate_manager'  },
  },

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
