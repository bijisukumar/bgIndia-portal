-- ════════════════════════════════════════════════════════════

-- STRUCTURED LOCATION BACKFILL for stays -- 33 of the 42 newly

-- inserted backfilled stays (backfill-drive-recovered-stays.sql)

-- have address data we can map into stays' own location columns

-- (home_address, city, state, country, pincode), added by

-- migrate-location-columns.sql and written by the live check-in

-- form (src/screens/GuestCheckIn.jsx).

--

-- This was missed in the original backfill script because at the

-- time, schema.sql (which doesn't reflect this migration) was the

-- only schema reference available -- the live stays table actually

-- has these columns already. fill-guest-addresses.sql separately

-- filled guests.address/from_city/state/country as a combined text

-- field; this script fills the same underlying data properly

-- structured on stays, matching how the live form does it.

--

-- SAFE: only fills a column if it's currently NULL/blank.

-- ════════════════════════════════════════════════════════════



UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'Old No 372 New No 66, 19th Main Rd, Near Benaka Party Hall, 1st block Rajajinagar, Bangalore North'), city = COALESCE(NULLIF(TRIM(city), ''), 'Bangalore'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Bangalore'), state = COALESCE(NULLIF(TRIM(state), ''), 'Karnataka'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560010'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2024-BF016';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'Tower 9, 1402, LnT Raintree Boulevard, Byatarayanapura'), city = COALESCE(NULLIF(TRIM(city), ''), 'Bangalore'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Bangalore'), state = COALESCE(NULLIF(TRIM(state), ''), 'Karnataka'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560092'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2025-BF024';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'D 203 Samhita rainbow Apartments, Thubarahalli'), city = COALESCE(NULLIF(TRIM(city), ''), 'Bangalore'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Bangalore'), state = COALESCE(NULLIF(TRIM(state), ''), 'Karnataka'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560066'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2025-BF033';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), '#798, Banashankari 6th stage, 10th block'), city = COALESCE(NULLIF(TRIM(city), ''), 'Bangalore'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Bangalore'), state = COALESCE(NULLIF(TRIM(state), ''), 'Karnataka'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560060'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2025-BF032';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'G-5, Khumbha Lake Shore -3, Lake View Residency Layout, Kodichikkanahalli, Banagalore'), city = COALESCE(NULLIF(TRIM(city), ''), 'Bangalore'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Bangalore'), state = COALESCE(NULLIF(TRIM(state), ''), 'Karnataka'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560076'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2026-BF038';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), '#78, 2nd main road, between 6th and 7th cross, bangalore south, PO: Chamrajpet'), city = COALESCE(NULLIF(TRIM(city), ''), 'Bangalore'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Bangalore'), state = COALESCE(NULLIF(TRIM(state), ''), 'Karnataka'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560018'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2026-BF037';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'A03, Uniworth Tranqui Apts, Doddabele Road, Kengeri'), city = COALESCE(NULLIF(TRIM(city), ''), 'Bangalore'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Bangalore'), state = COALESCE(NULLIF(TRIM(state), ''), 'Karnataka'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560060'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2025-BF035';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'Whitefield Bangalore India, Whitefield'), city = COALESCE(NULLIF(TRIM(city), ''), 'Bangalore'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Bangalore'), state = COALESCE(NULLIF(TRIM(state), ''), 'Karnataka'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560066'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2025-BF030';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), '40, Vishwam Inside Out, 1st Cross Street, T.Vijayakumar Layout, Doddakannelli'), city = COALESCE(NULLIF(TRIM(city), ''), 'Bengaluru'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Bengaluru'), state = COALESCE(NULLIF(TRIM(state), ''), 'Karnataka'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560035'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2024-BF003';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'No, 830, 7th main road, ISRo layout'), city = COALESCE(NULLIF(TRIM(city), ''), 'Bengaluru'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Bengaluru'), state = COALESCE(NULLIF(TRIM(state), ''), 'Karnataka'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560078'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2024-BF017';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'maruvalassery house, viswamnagar, palluruthy, cochin-6'), city = COALESCE(NULLIF(TRIM(city), ''), 'Cochin'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Cochin'), state = COALESCE(NULLIF(TRIM(state), ''), 'Kerala'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2024-BF019';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'IV/118, PARUTHIYEZHATHU HOUSE, ELAMKUNNAPUZHA PO, GANAPATHIMUKKU, VYPIN'), city = COALESCE(NULLIF(TRIM(city), ''), 'Ernakulam'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Ernakulam'), state = COALESCE(NULLIF(TRIM(state), ''), 'Kerala'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '682503'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2024-BF018';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'Valiyavilayil House. Karikode. Mulanthuruthy, Ernakulam. PIN. Kerala. India'), city = COALESCE(NULLIF(TRIM(city), ''), 'Ernakulam'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Ernakulam'), state = COALESCE(NULLIF(TRIM(state), ''), 'Kerala'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '682314'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2024-BF020';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'Pothanikatt, Kothamangalam P O, Kothamangalam'), city = COALESCE(NULLIF(TRIM(city), ''), 'Ernakulam'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Ernakulam'), state = COALESCE(NULLIF(TRIM(state), ''), 'Kerala'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '686691'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2025-BF028';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'Gokulam'), city = COALESCE(NULLIF(TRIM(city), ''), 'Kannur'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Kannur'), state = COALESCE(NULLIF(TRIM(state), ''), 'Kerala'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '670702'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2026-BF041';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'Karuvanthodi (House) Chengottur (Post) Thottapaya, Kottakkal'), city = COALESCE(NULLIF(TRIM(city), ''), 'Malappuram'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Malappuram'), state = COALESCE(NULLIF(TRIM(state), ''), 'Kerala'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '676503'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2024-BF001';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'MOHANALAYAM, KARAZHMA WEST, CHERUKOLE P.O. MAVELIKARA, ALAPPUZHA DISTRICT'), city = COALESCE(NULLIF(TRIM(city), ''), 'Mavelikara'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Mavelikara'), state = COALESCE(NULLIF(TRIM(state), ''), 'Kerala'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '690104'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2024-BF011';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'LEKSHMI NIVAS PONNARAMTHOTTAM, MAVELIKARA, ALAPPUZHA'), city = COALESCE(NULLIF(TRIM(city), ''), 'Mavelikara'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Mavelikara'), state = COALESCE(NULLIF(TRIM(state), ''), 'Kerala'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '690101'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2026-BF042';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'Sasneham Nemmara'), city = COALESCE(NULLIF(TRIM(city), ''), 'Palakkad'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Palakkad'), state = COALESCE(NULLIF(TRIM(state), ''), 'Kerala'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '678508'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2024-BF004';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), '201 Omana Bappuni Nagar Pongumoodu'), city = COALESCE(NULLIF(TRIM(city), ''), 'Trivandrum'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Trivandrum'), state = COALESCE(NULLIF(TRIM(state), ''), 'Kerala'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2026-BF039';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'B-12, Mangaldeep, P and T colony, Dombivili East'), city = COALESCE(NULLIF(TRIM(city), ''), 'Mumbai'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Mumbai'), state = COALESCE(NULLIF(TRIM(state), ''), 'Maharashtra'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '421201'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2026-BF040';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), '502 Macaw, Nyati Enclave, Nyati County, Mohammadwadi, Pune 411 060'), city = COALESCE(NULLIF(TRIM(city), ''), 'Pune'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Pune'), state = COALESCE(NULLIF(TRIM(state), ''), 'Maharashtra'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2025-BF022';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'NO. 30 SAINT VINCENT DEPAUL STREET COLASNAGAR'), city = COALESCE(NULLIF(TRIM(city), ''), 'Pondicherry'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Pondicherry'), state = COALESCE(NULLIF(TRIM(state), ''), 'Pondicherry'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '605001'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2024-BF002';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'No 19, Chokkalingam street, Rajiv Nagar, Vaanagaram, Chennai 77'), city = COALESCE(NULLIF(TRIM(city), ''), 'Chennai'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Chennai'), state = COALESCE(NULLIF(TRIM(state), ''), 'Tamil Nadu'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2024-BF014';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'plot no. 36 Mahilam Avenue Karayanchavadi Avadi Road POONAMALLEE'), city = COALESCE(NULLIF(TRIM(city), ''), 'Chennai'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Chennai'), state = COALESCE(NULLIF(TRIM(state), ''), 'Tamil Nadu'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '600056'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2025-BF036';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'No 71 Ashrya villas mullai nagar Pannimadai'), city = COALESCE(NULLIF(TRIM(city), ''), 'Coimbatore'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Coimbatore'), state = COALESCE(NULLIF(TRIM(state), ''), 'Tamil Nadu'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '641017'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2025-BF027';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'W/O, Samyappan, 102, Velliyankattupudur, Nagadevampalayam, Erode District, Tamilnadu'), city = COALESCE(NULLIF(TRIM(city), ''), 'Erode'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Erode'), state = COALESCE(NULLIF(TRIM(state), ''), 'Tamil Nadu'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '638476'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2025-BF034';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'No. 58, Perumal Kovil Street'), city = COALESCE(NULLIF(TRIM(city), ''), 'Tindivanam'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Tindivanam'), state = COALESCE(NULLIF(TRIM(state), ''), 'Tamil Nadu'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '604001'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2025-BF025';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), '62/85, Thiru Nagar Ext, mangalam road'), city = COALESCE(NULLIF(TRIM(city), ''), 'Tirupur'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Tirupur'), state = COALESCE(NULLIF(TRIM(state), ''), 'Tamil Nadu'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '641604'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2024-BF013';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), '1-9-1113/12.vidyanagar. Hyderabad.'), city = COALESCE(NULLIF(TRIM(city), ''), 'Hyderabad'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Hyderabad'), state = COALESCE(NULLIF(TRIM(state), ''), 'Telangana'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '500044'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2025-BF023';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'H. No 1/20/3 Venkatapuram Trimulgherry P O'), city = COALESCE(NULLIF(TRIM(city), ''), 'Secunderabad'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Secunderabad'), state = COALESCE(NULLIF(TRIM(state), ''), 'Telangana'), country = COALESCE(NULLIF(TRIM(country), ''), 'India'), pincode = COALESCE(NULLIF(TRIM(pincode), ''), '500015'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2024-BF010';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'Doha Qatar'), city = COALESCE(NULLIF(TRIM(city), ''), 'Doha'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Doha'), country = COALESCE(NULLIF(TRIM(country), ''), 'Qatar'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2024-BF015';

UPDATE stays SET home_address = COALESCE(NULLIF(TRIM(home_address), ''), 'Saudi Arabia / Riyadh 13326'), city = COALESCE(NULLIF(TRIM(city), ''), 'Riyadh'), from_city = COALESCE(NULLIF(TRIM(from_city), ''), 'Riyadh'), country = COALESCE(NULLIF(TRIM(country), ''), 'Saudi Arabia'), updated_by = 'system', updated_at = datetime('now') WHERE stay_id = 'DWK-2025-BF031';