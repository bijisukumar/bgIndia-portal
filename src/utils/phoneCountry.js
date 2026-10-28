// The country a phone number belongs to, from its international calling code (2026-10-28: the flag and country name beside a guest's
// phone number on Complete booking). Pure: it takes the DIGITS of the number with the country code in front, which is what
// waNumber() in guestMessages.js already produces for every wa.me link (a bare 10-digit number is India's, '00' and '+' mean the
// country code is already there), so the screen and the WhatsApp link can never disagree about which country a number is.
//
// Longest matching code wins ('971' UAE before '9'), and the shared codes are split the way the numbering plan splits them:
//   +1   North America: the area code (the next three digits) tells Canada, a Caribbean island or the United States
//   +7   Russia, except 76x and 77x, which are Kazakhstan
// +44 (UK, Jersey, Guernsey, Isle of Man) and +262 (Réunion, Mayotte) are not split: the first is the UK for every ordinary number.

const CODES = {
  '20': 'EG', '211': 'SS', '212': 'MA', '213': 'DZ', '216': 'TN', '218': 'LY', '220': 'GM', '221': 'SN', '222': 'MR', '223': 'ML',
  '224': 'GN', '225': 'CI', '226': 'BF', '227': 'NE', '228': 'TG', '229': 'BJ', '230': 'MU', '231': 'LR', '232': 'SL', '233': 'GH',
  '234': 'NG', '235': 'TD', '236': 'CF', '237': 'CM', '238': 'CV', '239': 'ST', '240': 'GQ', '241': 'GA', '242': 'CG', '243': 'CD',
  '244': 'AO', '245': 'GW', '246': 'IO', '248': 'SC', '249': 'SD', '250': 'RW', '251': 'ET', '252': 'SO', '253': 'DJ', '254': 'KE',
  '255': 'TZ', '256': 'UG', '257': 'BI', '258': 'MZ', '260': 'ZM', '261': 'MG', '262': 'RE', '263': 'ZW', '264': 'NA', '265': 'MW',
  '266': 'LS', '267': 'BW', '268': 'SZ', '269': 'KM', '27': 'ZA', '290': 'SH', '291': 'ER', '297': 'AW', '298': 'FO', '299': 'GL',
  '30': 'GR', '31': 'NL', '32': 'BE', '33': 'FR', '34': 'ES', '350': 'GI', '351': 'PT', '352': 'LU', '353': 'IE', '354': 'IS',
  '355': 'AL', '356': 'MT', '357': 'CY', '358': 'FI', '359': 'BG', '36': 'HU', '370': 'LT', '371': 'LV', '372': 'EE', '373': 'MD',
  '374': 'AM', '375': 'BY', '376': 'AD', '377': 'MC', '378': 'SM', '380': 'UA', '381': 'RS', '382': 'ME', '383': 'XK', '385': 'HR',
  '386': 'SI', '387': 'BA', '389': 'MK', '39': 'IT',
  '40': 'RO', '41': 'CH', '420': 'CZ', '421': 'SK', '423': 'LI', '43': 'AT', '44': 'GB', '45': 'DK', '46': 'SE', '47': 'NO', '48': 'PL', '49': 'DE',
  '500': 'FK', '501': 'BZ', '502': 'GT', '503': 'SV', '504': 'HN', '505': 'NI', '506': 'CR', '507': 'PA', '508': 'PM', '509': 'HT',
  '51': 'PE', '52': 'MX', '53': 'CU', '54': 'AR', '55': 'BR', '56': 'CL', '57': 'CO', '58': 'VE', '590': 'GP', '591': 'BO', '592': 'GY',
  '593': 'EC', '594': 'GF', '595': 'PY', '596': 'MQ', '597': 'SR', '598': 'UY', '599': 'CW',
  '60': 'MY', '61': 'AU', '62': 'ID', '63': 'PH', '64': 'NZ', '65': 'SG', '66': 'TH', '670': 'TL', '672': 'NF', '673': 'BN', '674': 'NR',
  '675': 'PG', '676': 'TO', '677': 'SB', '678': 'VU', '679': 'FJ', '680': 'PW', '681': 'WF', '682': 'CK', '683': 'NU', '685': 'WS',
  '686': 'KI', '687': 'NC', '688': 'TV', '689': 'PF', '690': 'TK', '691': 'FM', '692': 'MH',
  '81': 'JP', '82': 'KR', '84': 'VN', '850': 'KP', '852': 'HK', '853': 'MO', '855': 'KH', '856': 'LA', '86': 'CN', '880': 'BD', '886': 'TW',
  '90': 'TR', '91': 'IN', '92': 'PK', '93': 'AF', '94': 'LK', '95': 'MM', '960': 'MV', '961': 'LB', '962': 'JO', '963': 'SY', '964': 'IQ',
  '965': 'KW', '966': 'SA', '967': 'YE', '968': 'OM', '970': 'PS', '971': 'AE', '972': 'IL', '973': 'BH', '974': 'QA', '975': 'BT',
  '976': 'MN', '977': 'NP', '98': 'IR', '992': 'TJ', '993': 'TM', '994': 'AZ', '995': 'GE', '996': 'KG', '998': 'UZ',
}

// +1: Canada's area codes, and the Caribbean / Pacific islands that share the plan. Anything else is the United States.
const CANADA = new Set(('204 226 236 249 250 257 263 289 306 343 354 365 367 368 382 403 416 418 428 431 437 438 450 468 474 506 514 519 548 579 581 584 587 604 613 639 647 672 683 705 709 742 753 778 780 782 807 819 825 867 873 879 902 905 942').split(' '))
const NANP_ISLANDS = {
  '242': 'BS', '246': 'BB', '264': 'AI', '268': 'AG', '284': 'VG', '340': 'VI', '345': 'KY', '441': 'BM', '473': 'GD', '649': 'TC',
  '658': 'JM', '876': 'JM', '664': 'MS', '670': 'MP', '671': 'GU', '684': 'AS', '721': 'SX', '758': 'LC', '767': 'DM', '784': 'VC',
  '787': 'PR', '939': 'PR', '809': 'DO', '829': 'DO', '849': 'DO', '868': 'TT', '869': 'KN',
}

// { iso: 'IN', code: '+91' } for digits that begin with a known calling code, otherwise null.
export function countryFromDigits(digits) {
  const d = String(digits || '').replace(/\D/g, '')
  if (!d || d[0] === '0') return null
  if (d[0] === '1') {
    const area = d.slice(1, 4)
    return { iso: CANADA.has(area) ? 'CA' : (NANP_ISLANDS[area] || 'US'), code: '+1' }
  }
  if (d[0] === '7') return { iso: /^7[67]/.test(d) ? 'KZ' : 'RU', code: '+7' }
  for (const n of [3, 2]) {
    const iso = CODES[d.slice(0, n)]
    if (iso) return { iso, code: '+' + d.slice(0, n) }
  }
  return null
}

// 'India', 'United Arab Emirates': the browser's own region names, so no country list has to be shipped; the ISO code when
// the browser has none.
let names = null
export function countryName(iso) {
  try {
    if (!names) names = new Intl.DisplayNames(['en'], { type: 'region' })
    return names.of(iso) || iso
  } catch {
    return iso
  }
}
