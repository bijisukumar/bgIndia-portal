-- Fields from the "SoftLaunch - Friends and Family" Google Form.
ALTER TABLE platform_invite_requests ADD COLUMN property_type TEXT;  -- Villa / Flat / Rooms
ALTER TABLE platform_invite_requests ADD COLUMN airbnb_link   TEXT;  -- their live listing
ALTER TABLE platform_invite_requests ADD COLUMN onboard_3m    TEXT;  -- Yes / No, engage within 3 months
ALTER TABLE platform_invite_requests ADD COLUMN interests     TEXT;  -- which problems they want solved
