-- Migration: add property-characteristic columns to property_details
--
-- Root cause being fixed (2026-06-29): CONFIG.rentalProperties in
-- config.js has been the ONLY source of the property list across 5
-- screens (RentalProperties, RentalAgreement, PropertyDetails,
-- ClaimsLedger, ClaimsReport) -- it's a hardcoded array, not loaded
-- from the database. Every "Add Property" flow does
-- CONFIG.rentalProperties.push(...), which mutates the in-memory JS
-- object for that page load ONLY -- it's never persisted, so a newly
-- added property (the reported case: a US property, "309 N Main,
-- Randolph, TX 75475") vanishes from every screen the moment the page
-- reloads, even though it WAS correctly saved to rental_props itself.
--
-- This migration adds the columns property_details was missing to
-- fully replace CONFIG.rentalProperties as a data source: unit_no,
-- floor, building_name (distinct from the structured address --
-- this is the "Pinnacle Residency" style name used in legal/lease
-- phrasing), has_parking, furnishing. address/city/electricity
-- columns already existed (added in an earlier migration this
-- session for the document-address work).
--
-- A backfill UPDATE for the 3 existing India properties' static data
-- (previously only in config.js) is included below so nothing is
-- lost once CONFIG.rentalProperties stops being read as the source
-- of truth.
--
-- Run via D1 Admin / D1 console. Plain sequential statements only.

ALTER TABLE property_details ADD COLUMN unit_no       TEXT;
ALTER TABLE property_details ADD COLUMN floor         TEXT;
ALTER TABLE property_details ADD COLUMN building_name TEXT;
ALTER TABLE property_details ADD COLUMN has_parking   INTEGER DEFAULT 0;
ALTER TABLE property_details ADD COLUMN furnishing    TEXT;

-- Backfill the 3 existing India properties' static data from
-- config.js, so nothing is lost when the static list stops being the
-- source of truth.
INSERT OR IGNORE INTO property_details (prop_id) VALUES ('rental_1');
INSERT OR IGNORE INTO property_details (prop_id) VALUES ('rental_2');
INSERT OR IGNORE INTO property_details (prop_id) VALUES ('rental_3');

UPDATE property_details SET
  unit_no = 'T4 9D', floor = '9th', building_name = 'Tata Tritvam at Marine Drive',
  has_parking = 1, elec_consumer_id = COALESCE(elec_consumer_id, '1155466025977'),
  furnishing = 'semi furnished', city = COALESCE(city, 'Kochi')
WHERE prop_id = 'rental_1';

UPDATE property_details SET
  unit_no = '', floor = '', building_name = 'Pacifica',
  has_parking = 0, furnishing = 'non-furnished', city = COALESCE(city, 'Chennai')
WHERE prop_id = 'rental_2';

UPDATE property_details SET
  unit_no = '103', floor = '1st', building_name = 'Pinnacle Residency',
  has_parking = 0, furnishing = 'non-furnished', city = COALESCE(city, 'Trichur')
WHERE prop_id = 'rental_3';

-- Verify after running:
-- SELECT prop_id, unit_no, floor, building_name, has_parking, furnishing, city FROM property_details;
