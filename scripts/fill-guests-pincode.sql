-- ════════════════════════════════════════════════════════════

-- Fill guests.pincode -- run AFTER migrate-guests-add-pincode.sql

-- (which adds the column) and AFTER fill-guest-addresses.sql (which

-- already filled address/from_city/state/country but had nowhere

-- to put pincode since the column didn't exist on guests yet).

--

-- SAFE: only fills if currently NULL/blank.

-- ════════════════════════════════════════════════════════════



UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560010'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Janani Babukrishnan';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560038'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Arshad Pasha';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560038'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Romala Arunava Sarker';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560092'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Krishna Ravi Boonapalli';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560066'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Partheebaraj TS';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560060'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Sarjit Sagar';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560076'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Sreesha Ravindran';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560085'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Anita Damodaran';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560018'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Rishab K A';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560035'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Maddy Mahajan';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560060'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Yashin V S';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560066'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Rohith Arun';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560035'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Srividya Sathyamurthy';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560078'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Priya Dharshini S';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560102'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Chaithanya Mangalampalli';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '560048'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Anish Suresh Babu';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '688533'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Aditya Kishore';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '688531'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Aswin A';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '673002'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Vishnu Menon';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '682503'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Dr. Poornima';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '682314'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Bivin Babu';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '686691'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Milen Raj';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '670702'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Sangeeth Satheesh';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '691021'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'D S Ganesh';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '691601'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Suresh Bhaskaran';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '678506'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Arun Vijayagopalan';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '676503'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Jithuswaraj Karuvanthodi';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '690104'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Anil Kumar V';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '690101'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Aswin';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '678508'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Mahesh Mukundan';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '678501'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Harish K Chandran';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '678651'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Deepika M';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '673016'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Adarsh Krishnan';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '680014'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Arjun Freedom';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '680661'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'SreeKala Wilson';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '411019'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Ambika Menon';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '400071'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Divya Ramaswamy';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '421201'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Amith Ramachandran Nair';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '411044'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Rajendran Nair';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '411028'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Anish Pillay';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '400607'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Jaydeep Krishna';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '605001'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Karthik M';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '600050'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Manivannan Sekkappan';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '600014'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Nishanthi Yuvaraj';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '600095'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Vaisak Sasi';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '600044'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Chakri Kiriti';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '600056'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Santosh Kumaravel Sundaravadivelu';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '603103'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Ramkumar S R Menon';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '641004'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Sundararam Thanukrishnan';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '641004'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Krishnendu S';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '641017'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Arun Kumar';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '638476'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Sridhar V';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '638183'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Saravanan Ramasamy M';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '625009'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Karthic Radhakrishnan';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '623407'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Karthikeyan Bose';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '604001'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Balaji Narasimhan';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '641604'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Rahul Mani';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '603202'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Renuka Sasi';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '500044'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'M. Santhoshi Kumari';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '500074'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Manoj Kumar';

UPDATE guests SET pincode = COALESCE(NULLIF(TRIM(pincode), ''), '500015'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Asha Gopa Kumar';