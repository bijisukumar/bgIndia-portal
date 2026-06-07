-- bgIndia Portal — Location Backfill v3
-- Generated: 2026-05-18T17:09:09.017Z
-- Matched: 66

-- Ignore "duplicate column" errors for ALTER TABLE:
ALTER TABLE stays ADD COLUMN home_address TEXT;
ALTER TABLE stays ADD COLUMN city TEXT;
ALTER TABLE stays ADD COLUMN state TEXT;
ALTER TABLE stays ADD COLUMN country TEXT DEFAULT 'India';
ALTER TABLE stays ADD COLUMN from_city TEXT;
ALTER TABLE stays ADD COLUMN pincode TEXT;
ALTER TABLE stays ADD COLUMN govt_id_type TEXT;
ALTER TABLE stays ADD COLUMN govt_id_num TEXT;

-- Vikram BalaSubramanium · 2026-05-08 → DWK-2026-0001 [score:150]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = '#188, Phase I, Palm Meadows, Whitefield',
  city = 'Bengaluru',
  from_city = 'Bengaluru',
  state = 'Karnataka',
  country = 'India',
  pincode = '560066',
  govt_id_type = 'Aadhaar',
  govt_id_num = '421928926428',
  guest_email = COALESCE(NULLIF(guest_email,''),'vikram.r8183@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919845512667')
WHERE stay_id = 'DWK-2026-0001';

-- Kala · 2026-06-04 → HIST-20221010-VIPINK [score:80]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  country = 'India'
WHERE stay_id = 'HIST-20221010-VIPINK';

-- Aswin · 2026-05-16 → HIST-20260211-ASWIN [score:80]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'MAVELIKARA - 690101,',
  city = 'Mavelikara',
  from_city = 'Mavelikara',
  state = 'Kerala',
  country = 'India',
  pincode = '690101',
  govt_id_type = 'Aadhaar',
  govt_id_num = '972058317901',
  guest_email = COALESCE(NULLIF(guest_email,''),'aswinsnair08@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919446359430')
WHERE stay_id = 'HIST-20260211-ASWIN';

-- Manoj · 2026-04-25 → DWK-2026-0002 [score:180]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'H.no - 3-6-319',
  country = 'India',
  govt_id_type = 'Other',
  govt_id_num = '7959*0512*7242',
  guest_email = COALESCE(NULLIF(guest_email,''),'manojpotlapally@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+918374689656')
WHERE stay_id = 'DWK-2026-0002';

-- Sagar · 2026-04-17 → DWK-2026-0003 [score:180]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  country = 'India',
  guest_email = COALESCE(NULLIF(guest_email,''),'dr.sagarhl@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919538480455')
WHERE stay_id = 'DWK-2026-0003';

-- Sanjeev · 2026-04-11 → DWK-2026-0004 [score:180]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  country = 'India',
  guest_email = COALESCE(NULLIF(guest_email,''),'iamsanty@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919894859911')
WHERE stay_id = 'DWK-2026-0004';

-- Shilpa Gopan · ? → HIST-20260405-SHILPA [score:120]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  country = 'India'
WHERE stay_id = 'HIST-20260405-SHILPA';

-- Deepika · 2026-04-01 → DWK-2026-0007 [score:180]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'Luxury Villas of Guruvayur, Guruvayur -Kerala 680101, India',
  city = 'Thrissur',
  from_city = 'Thrissur',
  state = 'Kerala',
  country = 'India',
  pincode = '680101',
  govt_id_type = 'Aadhaar',
  govt_id_num = '857599113965',
  guest_email = COALESCE(NULLIF(guest_email,''),'deepikanair23669@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'918590361601')
WHERE stay_id = 'DWK-2026-0007';

-- Jijo Francis · 2026-03-29 → DWK-2026-0008 [score:200]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  country = 'India',
  govt_id_type = 'Aadhaar',
  govt_id_num = '383095254422',
  guest_email = COALESCE(NULLIF(guest_email,''),'jijofrancis.sv@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919100622448')
WHERE stay_id = 'DWK-2026-0008';

-- Moumita · 2026-03-18 → DWK-2026-0009 [score:180]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = '#⅗, Kingston Court, 2 Floor, Flat# F2, 2 Cross Vivekanand Nagar, Jai Bharath Nagar, Bangalore - 33',
  city = 'Bengaluru',
  from_city = 'Bengaluru',
  state = 'Karnataka',
  country = 'India',
  pincode = '560033',
  govt_id_type = 'Aadhaar',
  govt_id_num = '643209508827',
  guest_email = COALESCE(NULLIF(guest_email,''),'moumita.amazon@gamil.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919916673755')
WHERE stay_id = 'DWK-2026-0009';

-- Anita · 2026-02-27 → DWK-2026-0010 [score:180]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = '306, Skyline Surabhi Apartment, Vidyapeetha Road, Banashankari 3 rd Stage. Bangalore 560085',
  city = 'Bengaluru',
  from_city = 'Bengaluru',
  state = 'Karnataka',
  country = 'India',
  pincode = '560085',
  govt_id_type = 'Aadhaar',
  govt_id_num = '226961724006',
  guest_email = COALESCE(NULLIF(guest_email,''),'anitaa_naren@hotmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919845127249')
WHERE stay_id = 'DWK-2026-0010';

-- Sidharth · 2026-02-12 → DWK-2026-0011 [score:180]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'Devi Krishna ,Chittur College (PO),Ambattupalayam ,Chittur ,Palakkad (DT)',
  city = 'Palakkad',
  from_city = 'Palakkad',
  state = 'Kerala',
  country = 'India',
  govt_id_type = 'Passport',
  govt_id_num = 'T1902671',
  guest_email = COALESCE(NULLIF(guest_email,''),'sinuse1977@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+971557938756')
WHERE stay_id = 'DWK-2026-0011';

-- Jay Bhatt · 2025-02-08 → HIST-20260208-JAYBH [score:100]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = '50 Lucca Ave Morgan Hill CA 95037',
  city = 'Morgan Hill',
  from_city = 'Morgan Hill',
  state = 'California',
  country = 'United States',
  pincode = '95037',
  guest_email = COALESCE(NULLIF(guest_email,''),'jaynbhatt@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+16693045508')
WHERE stay_id = 'HIST-20260208-JAYBH';

-- Lini Nair · 2026-01-30 → DWK-2026-0013 [score:200]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = '110 Carlton Gore Roas Newmarket Auckland NZ 1023',
  city = 'Auckland',
  from_city = 'Auckland',
  state = 'Auckland',
  country = 'New Zealand',
  pincode = '1023',
  govt_id_type = 'Other',
  govt_id_num = 'RA378803',
  guest_email = COALESCE(NULLIF(guest_email,''),'linianair@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+64275263281')
WHERE stay_id = 'DWK-2026-0013';

-- Ajay · 2025-01-22 → HIST-20260122-AJAYRA [score:80]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = '902 , Northside , Hiranandani Meadows , Thane west Mumbai .',
  city = 'Thane',
  from_city = 'Thane',
  state = 'Maharashtra',
  country = 'India',
  pincode = '400610',
  guest_email = COALESCE(NULLIF(guest_email,''),'ajjukrao06@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919967950001')
WHERE stay_id = 'HIST-20260122-AJAYRA';

-- Madhu · 2025-01-15 → HIST-20230708-MADHU [score:80]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = '2 Adult, 2 Child',
  city = '2 Adult',
  from_city = '2 Adult',
  country = 'India',
  govt_id_type = 'Aadhaar',
  govt_id_num = '491708566044',
  guest_email = COALESCE(NULLIF(guest_email,''),'maddy.mahajan@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'8860102222')
WHERE stay_id = 'HIST-20230708-MADHU';

-- Harish Chandran · 2025-01-24 → HIST-20260124-HARISH [score:95]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'Advaitham House, 3/558, thekkethara, ayalur, Nemmara, Palakkad. 678501',
  city = 'Palakkad',
  from_city = 'Palakkad',
  state = 'Kerala',
  country = 'India',
  pincode = '678501',
  govt_id_type = 'Aadhaar',
  govt_id_num = '414035973047',
  guest_email = COALESCE(NULLIF(guest_email,''),'hkc141298@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+916351619634')
WHERE stay_id = 'HIST-20260124-HARISH';

-- Anish Suresh · 2026-01-28 → DWK-2026-0014 [score:180]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'Flat No. 102, Sai Residency 76,',
  country = 'India',
  govt_id_type = 'Other',
  govt_id_num = '9196 2206 7525 9916',
  guest_email = COALESCE(NULLIF(guest_email,''),'anish.9008@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+918147994317')
WHERE stay_id = 'DWK-2026-0014';

-- Sharath Balakrishnan · 2026-01-03 → DWK-2026-0017 [score:200]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  country = 'India'
WHERE stay_id = 'DWK-2026-0017';

-- Ram Kumar · 2025-12-27 → DWK-2025-0018 [score:180]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = '104, Jasmine Tower, Eden Park Phase 2,',
  city = 'Jasmine Tower',
  from_city = 'Jasmine Tower',
  country = 'India',
  govt_id_type = 'Aadhaar',
  govt_id_num = '288308747288',
  guest_email = COALESCE(NULLIF(guest_email,''),'ramkumar050@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919500100884')
WHERE stay_id = 'DWK-2025-0018';

-- Saravanan Ramaswamy · 2025-12-22 → DWK-2025-0019 [score:150]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = '62 West Colony komarapalayam 638183 Tamil nadu',
  city = '62 West Colony komarapalayam  Tamil nadu',
  from_city = '62 West Colony komarapalayam  Tamil nadu',
  state = 'Tamil Nadu',
  country = 'India',
  pincode = '638183',
  govt_id_type = 'Other',
  govt_id_num = 'RA5042192',
  guest_email = COALESCE(NULLIF(guest_email,''),'saravansydney@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+61437015716')
WHERE stay_id = 'DWK-2025-0019';

-- Manju Ajesh · 2025-12-18 → DWK-2025-0021 [score:195]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'Molel puthenpura Kizhumuri PO, Ramamangalam',
  city = 'Ramamangalam',
  from_city = 'Ramamangalam',
  state = 'Kerala',
  country = 'India',
  pincode = '686663',
  govt_id_type = 'Other',
  govt_id_num = 'RA1948118',
  guest_email = COALESCE(NULLIF(guest_email,''),'ajeshmanju@yahoo.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+61411536465')
WHERE stay_id = 'DWK-2025-0021';

-- Chaithanya Mangalampalli · 2025-12-21 → DWK-2025-0020 [score:200]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'Villa 147 RBD Stillwaters, Silver County Rd, Haralur Lake, HSR Layout, Bengaluru, Karnataka - 560102',
  city = 'Bangalore',
  from_city = 'Bangalore',
  state = 'Karnataka',
  country = 'India',
  pincode = '560102',
  guest_email = COALESCE(NULLIF(guest_email,''),'chaitaram@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919845005236')
WHERE stay_id = 'DWK-2025-0020';

-- Vishnu · 2025-12-05 → DWK-2025-0023 [score:180]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'ChalappuramCalicut -673002',
  city = 'Kozhikode',
  from_city = 'Kozhikode',
  state = 'Kerala',
  country = 'India',
  pincode = '673002',
  govt_id_type = 'Passport',
  govt_id_num = 'U0240936',
  guest_email = COALESCE(NULLIF(guest_email,''),'88vishnumenon@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919895515644')
WHERE stay_id = 'DWK-2025-0023';

-- Karthikeyan Bose · 2025-12-07 → DWK-2025-0022 [score:200]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = '3/595, ANJUKOTTAI, ANJUKOTTAI(PO),THIRUVADANAI(TK)RAMANATHAPURAM(DIST) 623407',
  city = 'Anjukottai',
  from_city = 'Anjukottai',
  state = 'Tamil Nadu',
  country = 'UK',
  pincode = '623407',
  govt_id_type = 'Aadhaar',
  govt_id_num = '675849937627',
  guest_email = COALESCE(NULLIF(guest_email,''),'karthikbose21@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919789471988')
WHERE stay_id = 'DWK-2025-0022';

-- Ambika Menon · 2025-11-30 → DWK-2025-0024 [score:200]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'RH 27/20, Pratapgad Housing society, MIDC G block, Sambhaji Nagar, Chinchwad, pune,411019',
  city = 'Pune',
  from_city = 'Pune',
  state = 'Maharashtra',
  country = 'India',
  pincode = '411019',
  govt_id_type = 'Aadhaar',
  govt_id_num = '276130646455',
  guest_email = COALESCE(NULLIF(guest_email,''),'ambikamenon11@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+918779441284')
WHERE stay_id = 'DWK-2025-0024';

-- Ritesh Nair · 2025-11-25 → DWK-2025-0025 [score:110]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  country = 'India',
  govt_id_type = 'Aadhaar',
  govt_id_num = '525196196250',
  guest_email = COALESCE(NULLIF(guest_email,''),'rs.ns1827@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+918884543434')
WHERE stay_id = 'DWK-2025-0025';

-- Suresh Bhaskaran · 2025-11-19 → DWK-2025-0026 [score:200]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'Nandhanam, Kuzhiyam North, Chemmakkadu, Periinadu PO, Kollam, Kerala 691601',
  city = 'Kollam',
  from_city = 'Kollam',
  state = 'Kerala',
  country = 'India',
  pincode = '691601',
  govt_id_type = 'Other',
  govt_id_num = '672897558',
  guest_email = COALESCE(NULLIF(guest_email,''),'sureshtb@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+17184831729')
WHERE stay_id = 'DWK-2025-0026';

-- Divya · 2025-10-23 → DWK-2025-0027 [score:180]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = '103 Ashok Kumar Towers, 47 Union Park, Chembur, Mumbai 400071.',
  city = 'मुंबई',
  from_city = 'मुंबई',
  state = 'महाराष्ट्र',
  country = 'India',
  pincode = '400071',
  govt_id_type = 'Passport',
  govt_id_num = 'S1396780',
  guest_email = COALESCE(NULLIF(guest_email,''),'divyaramaswamy9@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+16475729893')
WHERE stay_id = 'DWK-2025-0027';

-- Jaydeep · 2025-09-13 → DWK-2025-0028 [score:180]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'A1204, Jasmine CHS, Siddeshwar  Gardens, Kolshet Road, Thane West, Maharashtra- 400607',
  city = 'Mumbai',
  from_city = 'Mumbai',
  state = 'Maharashtra',
  country = 'India',
  pincode = '400607',
  govt_id_type = 'Aadhaar',
  govt_id_num = '424263661584',
  guest_email = COALESCE(NULLIF(guest_email,''),'krishna.jaydeep@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919029565578')
WHERE stay_id = 'DWK-2025-0028';

-- Sanjay Raja Gopal · 2025-08-04 → DWK-2025-0030 [score:180]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = '+44 7456 498699',
  city = '+44 7456',
  from_city = '+44 7456',
  country = 'India',
  pincode = '498699',
  govt_id_type = 'Other',
  govt_id_num = '143173394',
  guest_email = COALESCE(NULLIF(guest_email,''),'sanjarj@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+447456498699')
WHERE stay_id = 'DWK-2025-0030';

-- Milen · 2025-06-24 → HIST-20250723-MILEN [score:80]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'Pothanikatt,',
  city = 'Pothanikatt',
  from_city = 'Pothanikatt',
  country = 'India',
  govt_id_type = 'Aadhaar',
  govt_id_num = '700022785501',
  guest_email = COALESCE(NULLIF(guest_email,''),'milen.raj@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919400040966')
WHERE stay_id = 'HIST-20250723-MILEN';

-- Chakri Kiriti · 2025-07-03 → DWK-2025-0033 [score:200]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'No B1 daya dwaraka apartments, 2nd cross street new colony chrompet, chennai, tamilnadu -600044',
  city = 'Chennai',
  from_city = 'Chennai',
  state = 'Tamil Nadu',
  country = 'India',
  pincode = '600044',
  govt_id_type = 'Aadhaar',
  govt_id_num = '886838010766',
  guest_email = COALESCE(NULLIF(guest_email,''),'chakrikiriti.bh@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+16476172302')
WHERE stay_id = 'DWK-2025-0033';

-- Adarsh · ? → HIST-20250704-ADARSH [score:100]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'Panthayil house, Paladankandiyil, Kodamolikunnu, Thondayad, Nellikode PO, Kottulli, Kozhikode, Kerala 673016',
  city = 'Kozhikode',
  from_city = 'Kozhikode',
  state = 'Kerala',
  country = 'India',
  pincode = '673016',
  govt_id_type = 'Aadhaar',
  govt_id_num = '528493606415',
  guest_email = COALESCE(NULLIF(guest_email,''),'adarshkrishnanp@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919048350972')
WHERE stay_id = 'HIST-20250704-ADARSH';

-- Ganesh · ? → HIST-20250520-DSGA [score:100]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'Veenaserry, Jawahar Nagar -111, Pattathanam,Kollam691021 Tel 0474 2747032',
  city = 'Kollam',
  from_city = 'Kollam',
  state = 'Kerala',
  country = 'India',
  guest_email = COALESCE(NULLIF(guest_email,''),'dsganesh79@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'04742747032')
WHERE stay_id = 'HIST-20250520-DSGA';

-- Arun · ? → HIST-20250513-ARUNV [score:100]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'Kizhakke House,',
  city = 'Puthucode',
  from_city = 'Puthucode',
  state = 'Kerala',
  country = 'India',
  pincode = '678687',
  govt_id_type = 'Aadhaar',
  govt_id_num = '523407811814',
  guest_email = COALESCE(NULLIF(guest_email,''),'arun.pollachi@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919840721080')
WHERE stay_id = 'HIST-20250513-ARUNV';

-- Krishnamurti Anantanarayanan · 2025-05-02 → DWK-2025-M0286 [score:150]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = '52, Perumal Koil Street,',
  city = 'Chennai',
  from_city = 'Chennai',
  state = 'Tamil Nadu',
  country = 'India',
  pincode = '600082',
  govt_id_type = 'Aadhaar',
  govt_id_num = '346240050842',
  guest_email = COALESCE(NULLIF(guest_email,''),'dr.krishnamurti@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919444026098')
WHERE stay_id = 'DWK-2025-M0286';

-- Copy of Sibu George · 2025-04-18 → DWK-2025-0037 [score:145]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'Sibu Abraham George,',
  city = 'Shiv',
  from_city = 'Shiv',
  state = 'Bihar',
  country = 'India',
  pincode = '821105',
  govt_id_type = 'Passport',
  govt_id_num = 'Z3373818',
  guest_email = COALESCE(NULLIF(guest_email,''),'mailsibu@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'00971506836323')
WHERE stay_id = 'DWK-2025-0037';

-- Vaisak Sasi · 2025-04-06 → DWK-2025-M0285 [score:200]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'no 5 Dinesh nagar main road Mel Ayanambakkam ambattur Chennai 600095',
  city = 'Chennai',
  from_city = 'Chennai',
  state = 'Tamil Nadu',
  country = 'India',
  pincode = '600077',
  govt_id_type = 'Aadhaar',
  govt_id_num = '441996355272',
  guest_email = COALESCE(NULLIF(guest_email,''),'vaisak.sasi@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919500174118')
WHERE stay_id = 'DWK-2025-M0285';

-- Balaji · ? → HIST-20230126-GOKULP [score:100]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'A406 , DSR Spring beauty apartment, ITPL Main Road, Brookefield, AECS Layout, Bengaluru -560037',
  city = 'Bangalore',
  from_city = 'Bangalore',
  state = 'Karnataka',
  country = 'India',
  pincode = '560037',
  govt_id_type = 'Aadhaar',
  govt_id_num = '338486806220',
  guest_email = COALESCE(NULLIF(guest_email,''),'balaji.mechrocks@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919962260652')
WHERE stay_id = 'HIST-20230126-GOKULP';

-- Ravi · 2025-02-23 → HIST-20220407-RAVISA [score:80]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'Tower 9,  1402, LnT Raintree Boulevard, Byatarayanapura, Bangalore-560092',
  city = 'Bengaluru',
  from_city = 'Bengaluru',
  state = 'Karnataka',
  country = 'India',
  pincode = '560092',
  govt_id_type = 'Aadhaar',
  govt_id_num = '677586375297',
  guest_email = COALESCE(NULLIF(guest_email,''),'rboonapalli@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+918197014422')
WHERE stay_id = 'HIST-20220407-RAVISA';

-- Karthic Radhakrishnan · 2025-02-14 → DWK-2025-M0284 [score:200]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = '392/3 Babu Nagar, Behind Teachers Colony, Anuppanadi Road, Madurai-625009.',
  city = 'Madurai',
  from_city = 'Madurai',
  state = 'Tamil Nadu',
  country = 'India',
  pincode = '625009',
  govt_id_type = 'Aadhaar',
  govt_id_num = '831403350901',
  guest_email = COALESCE(NULLIF(guest_email,''),'srkkece03@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+12067903054')
WHERE stay_id = 'DWK-2025-M0284';

-- Navar Reddy · 2025-01-25 → DWK-2025-M0283 [score:200]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'Flat 502, Eternal Raga , Saidabad, Hyderabad, Telangana',
  city = 'Hyderabad',
  from_city = 'Hyderabad',
  state = 'Telangana',
  country = 'India',
  guest_email = COALESCE(NULLIF(guest_email,''),'navarreddy@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+14402124315')
WHERE stay_id = 'DWK-2025-M0283';

-- Gayu Venu · 2025-01-31 → DWK-2025-0038 [score:200]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'No.59,Jalan Setia 3, Taman Setia Senai, 81400 Senai, Johor. MY',
  city = 'Senai',
  from_city = 'Senai',
  state = 'Johor Darul Ta''zim',
  country = 'Malaysia',
  pincode = '81400',
  govt_id_type = 'Other',
  govt_id_num = 'A59721722',
  guest_email = COALESCE(NULLIF(guest_email,''),'sanjana_gayu@yahoo.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+601115173804')
WHERE stay_id = 'DWK-2025-0038';

-- Aditya KIshore · 2024-12-22 → DWK-2024-0040 [score:200]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'Anusruthi,',
  city = 'Anusruthi',
  from_city = 'Anusruthi',
  country = 'India',
  govt_id_type = 'Passport',
  govt_id_num = 'R9741151',
  guest_email = COALESCE(NULLIF(guest_email,''),'adityakishore.7@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919633726718')
WHERE stay_id = 'DWK-2024-0040';

-- Romala · 2024-12-30 → DWK-2024-0039 [score:180]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = '332, Double Road, indranagar bangalore 560038',
  city = 'Bengaluru',
  from_city = 'Bengaluru',
  state = 'Karnataka',
  country = 'India',
  pincode = '560071',
  guest_email = COALESCE(NULLIF(guest_email,''),'pashaarshad6@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919008523020')
WHERE stay_id = 'DWK-2024-0039';

-- Selva Raju · 2024-12-09 → DWK-2024-0042 [score:180]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  country = 'India',
  guest_email = COALESCE(NULLIF(guest_email,''),'selvap2g@gmail.com')
WHERE stay_id = 'DWK-2024-0042';

-- Akash · 2024-12-04 → DWK-2024-0043 [score:180]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  country = 'India',
  guest_email = COALESCE(NULLIF(guest_email,''),'akashdevil69@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+917259681901')
WHERE stay_id = 'DWK-2024-0043';

-- Nishanthi Yuva Raj · 2024-11-07 → DWK-2024-0044 [score:180]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = '37 Ammaiappan street Royapettah, Chennai -600014',
  city = 'Chennai',
  from_city = 'Chennai',
  state = 'Tamil Nadu',
  country = 'India',
  pincode = '600014',
  govt_id_type = 'Aadhaar',
  govt_id_num = '476869528293',
  guest_email = COALESCE(NULLIF(guest_email,''),'nishanthi.y@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+916381386316')
WHERE stay_id = 'DWK-2024-0044';

-- Anish · ? → HIST-20260128-ANISH [score:100]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'B-907 Prithvi Presidio, Quadra Campus, Magarpatta Road, Pune 411028',
  city = 'Pune',
  from_city = 'Pune',
  state = 'Maharashtra',
  country = 'India',
  pincode = '411028',
  guest_email = COALESCE(NULLIF(guest_email,''),'anishpillay@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919764051911')
WHERE stay_id = 'HIST-20260128-ANISH';

-- Shyam · 2024-10-12 → HIST-20190606-SHYAM [score:80]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'maruvalassery house, viswamnagar, palluruthy, cochin-6',
  city = 'Kochi',
  from_city = 'Kochi',
  state = 'Kerala',
  country = 'India',
  pincode = '682006',
  govt_id_type = 'Aadhaar',
  govt_id_num = '579895368392',
  guest_email = COALESCE(NULLIF(guest_email,''),'shyamkumarma1994@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+917736326693')
WHERE stay_id = 'HIST-20190606-SHYAM';

-- Priya · 2024-09-27 → HIST-20230429-SNEHA [score:80]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'No , 830, 7th main road, ISRo layout,',
  city = 'Bengaluru',
  from_city = 'Bengaluru',
  state = 'Karnataka',
  country = 'India',
  pincode = '560111',
  govt_id_type = 'Aadhaar',
  govt_id_num = '615104668140',
  guest_email = COALESCE(NULLIF(guest_email,''),'psubr225@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919980531484')
WHERE stay_id = 'HIST-20230429-SNEHA';

-- Vimal · 2024-09-05 → DWK-2024-0048 [score:180]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  country = 'India'
WHERE stay_id = 'DWK-2024-0048';

-- Prakash · 2024-09-09 → DWK-2024-0046 [score:180]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = '40SBM Coloby 1st main Road',
  city = 'Bengaluru',
  from_city = 'Bengaluru',
  state = 'Karnataka',
  country = 'India',
  pincode = '560054',
  govt_id_type = 'Aadhaar',
  govt_id_num = '703715542170',
  guest_email = COALESCE(NULLIF(guest_email,''),'prakash@cloudwave.in'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919591233005')
WHERE stay_id = 'DWK-2024-0046';

-- Vibin · 2024-09-07 → DWK-2024-0047 [score:180]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  country = 'India'
WHERE stay_id = 'DWK-2024-0047';

-- Krishnendu · 2024-08-17 → DWK-2024-0050 [score:180]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = '27 , cape neem land , V.K road, Peelamedu , Coimbatore 641004 Tamilnadu.',
  city = 'Coimbatore',
  from_city = 'Coimbatore',
  state = 'Tamil Nadu',
  country = 'India',
  pincode = '641004',
  govt_id_type = 'Aadhaar',
  govt_id_num = '567374205668',
  guest_email = COALESCE(NULLIF(guest_email,''),'krishnendushiva@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'7353191783')
WHERE stay_id = 'DWK-2024-0050';

-- Manivannan · ? → HIST-20240814-MANIVA [score:100]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = '1165 WESTEND colony, Annanagar West extn, Chennai - 600050',
  city = 'Chennai',
  from_city = 'Chennai',
  state = 'Tamil Nadu',
  country = 'India',
  pincode = '600050'
WHERE stay_id = 'HIST-20240814-MANIVA';

-- Challenge · ? → HIST-20240625-CHALLE [score:100]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  country = 'India'
WHERE stay_id = 'HIST-20240625-CHALLE';

-- Sundararam · ? → HIST-20240605-SUNDAR [score:100]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = '51, RADHAKRISHNA MILLS C COLONY,',
  city = 'RADHAKRISHNA MILLS C COLONY',
  from_city = 'RADHAKRISHNA MILLS C COLONY',
  country = 'India',
  govt_id_type = 'Aadhaar',
  govt_id_num = '265668742649',
  guest_email = COALESCE(NULLIF(guest_email,''),'mailtosundart@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919047475025')
WHERE stay_id = 'HIST-20240605-SUNDAR';

-- Renuka · ? → HIST-20240615-RENUKA [score:100]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'H3 405 Tower 7, Shriram Shankari Apartments, Thangappapuram, Annai Meenakshi Nagar, Perumatunallur, Guduvanchery, Tamil Nadu 603202',
  city = 'Guduvanchery',
  from_city = 'Guduvanchery',
  state = 'Tamil Nadu',
  country = 'India',
  pincode = '603202',
  govt_id_type = 'Aadhaar',
  govt_id_num = '597985471821',
  guest_email = COALESCE(NULLIF(guest_email,''),'renukasasi@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919500992376')
WHERE stay_id = 'HIST-20240615-RENUKA';

-- Rajendra Nair · ? → HIST-20240420-RAJEND [score:100]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  home_address = 'Deepa plot no 471 sector no 25 Nigdi Pradhikaran, Pune 411044',
  city = 'Pimpri-Chinchwad',
  from_city = 'Pimpri-Chinchwad',
  state = 'Maharashtra',
  country = 'India',
  pincode = '411044',
  govt_id_type = 'Aadhaar',
  govt_id_num = '508709737983',
  guest_email = COALESCE(NULLIF(guest_email,''),'raj0313@gmail.com'),
  guest_phone = COALESCE(NULLIF(guest_phone,''),'+919370780555')
WHERE stay_id = 'HIST-20240420-RAJEND';

-- Pooja · 2024-03-17 → DWK-2024-0057 [score:180]
UPDATE stays SET
  updated_by = 'system',
  updated_at = datetime('now'),
  country = 'India'
WHERE stay_id = 'DWK-2024-0057';

SELECT 'Updated' lbl, COUNT(*) cnt FROM stays WHERE from_city IS NOT NULL AND from_city!='';
SELECT 'Missing city' lbl, COUNT(*) cnt FROM stays WHERE (from_city IS NULL OR from_city='') AND status NOT IN ('cancelled');