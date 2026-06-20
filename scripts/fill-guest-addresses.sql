-- ════════════════════════════════════════════════════════════

-- GUEST ADDRESS BACKFILL -- fills guests.address / from_city / state /

-- country for 83 guests, parsed from the Google Drive check-in form

-- crawl (Feb 2024 - Jun 2026). Address text combines Line 1 + Line 2 +

-- Zipcode into the single 'address' column the schema provides --

-- there's no separate line1/line2/zip column on guests.

--

-- City/State/Country were parsed and cross-checked (word-boundary safe

-- matching against an Indian city/state dictionary, international country

-- signals, and a handful of manual corrections confirmed via web search --

-- e.g. Guduvanchery -> Chennai, Doha for Qatar, Riyadh for Saudi Arabia,

-- Auckland for New Zealand, Morgan Hill/California for the US address,

-- Senai/Johor for the Malaysia address).

--

-- SAFE: only fills guests.address/from_city/state/country if currently

-- blank -- never overwrites existing data. Matches on exact guests.name,

-- which must already exist (i.e. run AFTER backfill-drive-recovered-stays.sql

-- and reset-and-rebackfill-guests-fk-safe.sql, which is what creates/updates

-- the guests rows this script fills in).

--

-- 4 guests from the Drive crawl are intentionally excluded here because

-- they have no corresponding guests row yet (Vikram Ramasubramanian,

-- Balaji A, Rajani Balachandran [cancelled], Vasanth Balasubramaniam

-- [unclear date]) -- nothing to update until/unless those get resolved.

-- ════════════════════════════════════════════════════════════



UPDATE guests SET from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Bangalore'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Karnataka'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Pooja Devan';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Old No 372 New No 66, 19th Main Rd, Near Benaka Party Hall, 1st block Rajajinagar, Bangalore North - 560010'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Bangalore'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Karnataka'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Janani Babukrishnan';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), '332, Double Road, indranagar - 560038'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Bangalore'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Karnataka'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Arshad Pasha';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), '332, Double Road, indranagar - 560038'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Bangalore'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Karnataka'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Romala Arunava Sarker';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Tower 9, 1402, LnT Raintree Boulevard, Byatarayanapura - 560092'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Bangalore'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Karnataka'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Krishna Ravi Boonapalli';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'D 203 Samhita rainbow Apartments, Thubarahalli - 560066'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Bangalore'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Karnataka'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Partheebaraj TS';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), '#798, Banashankari 6th stage, 10th block - 560060'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Bangalore'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Karnataka'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Sarjit Sagar';

UPDATE guests SET from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Bangalore'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Karnataka'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Rithesh Nair';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'G-5, Khumbha Lake Shore -3, Lake View Residency Layout, Kodichikkanahalli, Banagalore - 560076'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Bangalore'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Karnataka'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Sreesha Ravindran';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), '306, Skyline Surabhi Apartment, Vidyapeetha Road, Banashankari 3rd Stage. - 560085'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Bangalore'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Karnataka'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Anita Damodaran';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), '#3/5, Kingston Court, 2 Floor, Flat# F2, 2 Cross Vivekanand Nagar, Jai Bharath Nagar, Bangalore - 33'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Bangalore'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Karnataka'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Moumita Mukherjee';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), '#78, 2nd main road, between 6th and 7th cross, bangalore south, PO: Chamrajpet - 560018'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Bangalore'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Karnataka'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Rishab K A';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), '40 SBM Colony 1st main Road Chunchaghatta Konanakunte-Banglaore, Chunchaghatta'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Bangalore'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Karnataka'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Prakash Mr';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Vera-804, SJR Verity Apartment, Hosa Road, Kasavanahalli - 560035'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Bangalore'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Karnataka'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Maddy Mahajan';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'A03, Uniworth Tranqui Apts, Doddabele Road, Kengeri - 560060'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Bangalore'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Karnataka'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Yashin V S';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Whitefield Bangalore India, Whitefield - 560066'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Bangalore'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Karnataka'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Rohith Arun';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), '40, Vishwam Inside Out, 1st Cross Street, T.Vijayakumar Layout, Doddakannelli - 560035'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Bengaluru'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Karnataka'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Srividya Sathyamurthy';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'No, 830, 7th main road, ISRo layout - 560078'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Bengaluru'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Karnataka'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Priya Dharshini S';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Villa 147 RBD Stillwaters, Silver County Rd, Haralur Lake, HSR Layout - 560102'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Bengaluru'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Karnataka'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Chaithanya Mangalampalli';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Flat No. 102, Sai Residency 76, 3rd Cross, Ashraya Layout, 2nd Stage, Garudachar Palya, Mahadevapura - 560048'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Bengaluru'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Karnataka'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Anish Suresh Babu';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Anusruthi, Kodamthuruth, Kuthiathode PO, Alappuzha district - 688533'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Alappuzha'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Aditya Kishore';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Vrindavan (H), pattanakkad P.O, cherthala - 688531'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Alappuzha'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Aswin A';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Aksharam 19/560A Chalappuram - 673002'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Calicut'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Vishnu Menon';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'maruvalassery house, viswamnagar, palluruthy, cochin-6'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Cochin'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Shyam Kumar MA';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'IV/118, PARUTHIYEZHATHU HOUSE, ELAMKUNNAPUZHA PO, GANAPATHIMUKKU, VYPIN - 682503'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Ernakulam'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Dr. Poornima';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Valiyavilayil House. Karikode. Mulanthuruthy, Ernakulam. PIN. Kerala. India - 682314'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Ernakulam'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Bivin Babu';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Pothanikatt, Kothamangalam P O, Kothamangalam - 686691'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Ernakulam'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Milen Raj';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Anugraha opp Elayavoor Co op Bank Chovva'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Kannur'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Sanjay Rajagopal';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Gokulam - 670702'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Kannur'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Sangeeth Satheesh';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Veenaserry, Jawahar Nagar -111, Pattathanam - 691021'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Kollam'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'D S Ganesh';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Nandhanam, Kuzhiyam North, Chemmakkadu, Periinadu PO - 691601'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Kollam'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Suresh Bhaskaran';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Kizhakke House, Puzhakkal Thara - 678506'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Kollengode'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Arun Vijayagopalan';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Karuvanthodi (House) Chengottur (Post) Thottapaya, Kottakkal - 676503'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Malappuram'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Jithuswaraj Karuvanthodi';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'MOHANALAYAM, KARAZHMA WEST, CHERUKOLE P.O. MAVELIKARA, ALAPPUZHA DISTRICT - 690104'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Mavelikara'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Anil Kumar V';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'LEKSHMI NIVAS PONNARAMTHOTTAM, MAVELIKARA, ALAPPUZHA - 690101'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Mavelikara'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Aswin';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Sasneham Nemmara - 678508'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Palakkad'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Mahesh Mukundan';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Advaitham House, 3/558, thekkethara, ayalur, Nemmara, Palakkad. - 678501'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Palakkad'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Harish K Chandran';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Sreenandanam, Vellaroad, Mankara, Palakkad (DT)'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Palakkad'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Sidharth Santhosh';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Amritha krupa panavarambu manthakad junction malampuza palakad - 678651'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Palakkad'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Deepika M';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Puthenparampil, Sarawak House, Kattookara, Thiruvalla'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Pathanamthitta'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Sibu George';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Molel puthenpura Kizhumuri PO'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Ramamangalam'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Manju Ajesh Ajesh';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'SP XII/1785(1), Pananvila road, Powdikonam.P.O.'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Thiruvananthapuram'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Jijo Francis';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Panthayil house, Paladankandiyil, Kodamolikunnu, Thondayad, Nellikode PO, Kottulli, Kozhikode - 673016'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Thondayad'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Adarsh Krishnan';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'KAILATH HOUSE NEAR METHULI TEMPLE P.O PUTHUR - 680014'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Thrissur'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Arjun Freedom';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'PARAMEKKATTIL HOUSE, DOCTOR PADI WEST ROAD, NADAVARAMBA PO - 680661'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Thrissur'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'SreeKala Wilson';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), '201 Omana Bappuni Nagar Pongumoodu'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Trivandrum'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Kerala'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Parvathy Hemant';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'RH 27/20, Pratapgad Housing society, MIDC G block, Sambhaji Nagar, Chinchwad, pune - 411019'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Chinchwad'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Maharashtra'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Ambika Menon';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), '103 Ashok Kumar Towers, 47 Union Park, Chembur - 400071'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Mumbai'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Maharashtra'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Divya Ramaswamy';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), '902, Northside, Hiranandani Meadows, Thane west'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Mumbai'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Maharashtra'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'AjayRao';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'B-12, Mangaldeep, P and T colony, Dombivili East - 421201'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Mumbai'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Maharashtra'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Amith Ramachandran Nair';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Deepa plot no 471 sector no 25 Nigdi Pradhikaran - 411044'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Pune'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Maharashtra'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Rajendran Nair';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'B-907 Prithvi Presidio, Quadra Campus, Magarpatta Road - 411028'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Pune'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Maharashtra'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Anish Pillay';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), '502 Macaw, Nyati Enclave, Nyati County, Mohammadwadi, Pune 411 060'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Pune'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Maharashtra'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Ganesh Baliga';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Sinhgad Road manikbaugh, Flat no 23 Datta B apts Pune 51'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Pune'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Maharashtra'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Aparna Mahajan';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'A1204, Jasmine CHS, Siddeshwar Gardens, Kolshet Road, Thane West - 400607'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Thane'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Maharashtra'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Jaydeep Krishna';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'NO. 30 SAINT VINCENT DEPAUL STREET COLASNAGAR - 605001'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Pondicherry'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Pondicherry'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Karthik M';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'No 19, Chokkalingam street, Rajiv Nagar, Vaanagaram, Chennai 77'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Chennai'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Tamil Nadu'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Akila';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), '1165 WESTEND colony, Annanagar West extn - 600050'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Chennai'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Tamil Nadu'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Manivannan Sekkappan';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), '37 Ammaiappan street Royapettah - 600014'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Chennai'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Tamil Nadu'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Nishanthi Yuvaraj';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'no 5 Dinesh nagar main road Mel Ayanambakkam ambattur - 600095'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Chennai'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Tamil Nadu'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Vaisak Sasi';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'No B1 daya dwaraka apartments, 2nd cross street new colony chrompet, chennai, tamilnadu - 600044'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Chennai'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Tamil Nadu'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Chakri Kiriti';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'plot no. 36 Mahilam Avenue Karayanchavadi Avadi Road POONAMALLEE - 600056'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Chennai'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Tamil Nadu'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Santosh Kumaravel Sundaravadivelu';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), '104, Jasmine Tower, Eden Park Phase 2, M R Radha Main Road, Siruseri - 603103'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Chennai'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Tamil Nadu'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Ramkumar S R Menon';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), '51, RADHAKRISHNA MILLS C COLONY, PEELAMEDU - 641004'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Coimbatore'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Tamil Nadu'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Sundararam Thanukrishnan';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), '27, cape neem land, V.K road, Peelamedu, Coimbatore Tamilnadu - 641004'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Coimbatore'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Tamil Nadu'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Krishnendu S';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'No 71 Ashrya villas mullai nagar Pannimadai - 641017'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Coimbatore'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Tamil Nadu'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Arun Kumar';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'W/O, Samyappan, 102, Velliyankattupudur, Nagadevampalayam, Erode District, Tamilnadu - 638476'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Erode'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Tamil Nadu'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Sridhar V';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), '62 West Colony - 638183'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Komarapalayam'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Tamil Nadu'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Saravanan Ramasamy M';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), '392/3 Babu Nagar, Behind Teachers Colony, Anuppanadi Road - 625009'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Madurai'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Tamil Nadu'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Karthic Radhakrishnan';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), '3/595, ANJUKOTTAI, ANJUKOTTAI(PO), THIRUVADANAI(TK) RAMANATHAPURAM(DIST) - 623407'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Ramanathapuram'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Tamil Nadu'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Karthikeyan Bose';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), '52, Perumal Koil Street, Tenkasi TN'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Tenkasi'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Tamil Nadu'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Krishnamurti Anantanarayanam';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'No. 58, Perumal Kovil Street - 604001'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Tindivanam'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Tamil Nadu'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Balaji Narasimhan';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), '62/85, Thiru Nagar Ext, mangalam road - 641604'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Tirupur'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Tamil Nadu'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Rahul Mani';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'H3 405 Tower 7, Shriram Shankari Apartments, Thangappapuram, Annai Meenakshi Nagar, Perumatunallur, Guduvanchery - 603202'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Chennai'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Tamil Nadu'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Renuka Sasi';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Flat 502, Eternal Raga, Saidabad'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Hyderabad'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Telangana'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Navar Reddy';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), '1-9-1113/12.vidyanagar. Hyderabad. - 500044'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Hyderabad'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Telangana'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'M. Santhoshi Kumari';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'H.no - 3-6-319P Manoj Kumar Tnr Vaishnavi Shikhara Flat no 1304 SbI Colony, Lb nagar - 500074'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Hyderabad'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Telangana'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Manoj Kumar';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'H. No 1/20/3 Venkatapuram Trimulgherry P O - 500015'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Secunderabad'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Telangana'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'India'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Asha Gopa Kumar';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'No.59, Jalan Setia 3, Taman Setia Senai, 81400 Senai, Johor. MY'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Senai'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'Johor'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'Malaysia'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Gayu Venu';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), '110 Carlton Gore Road Newmarket Auckland NZ 1023'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Auckland'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'New Zealand'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Lini Nair';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Doha Qatar'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Doha'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'Qatar'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Preman';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), 'Saudi Arabia / Riyadh 13326'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Riyadh'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'Saudi Arabia'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Abdul Malik Al Saeed';

UPDATE guests SET address = COALESCE(NULLIF(NULLIF(TRIM(address), ''), '—'), '50 Lucca Ave Morgan Hill CA 95037'), from_city = COALESCE(NULLIF(NULLIF(TRIM(from_city), ''), '—'), 'Morgan Hill'), state = COALESCE(NULLIF(NULLIF(TRIM(state), ''), '—'), 'California'), country = COALESCE(NULLIF(NULLIF(TRIM(country), ''), '—'), 'USA'), updated_by = 'system', updated_at = datetime('now') WHERE name = 'Jay Bhatt';