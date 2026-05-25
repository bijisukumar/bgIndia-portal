# ============================================================
# CLIENT ONBOARDING CONFIG — bgIndia Portal
# ============================================================
# Copy this file when onboarding a new property.
# Update all values below, then update the CLIENT block
# in scripts/GuestFormScript.gs with the same values.
# ============================================================

# ── PROPERTY ─────────────────────────────────────────────────
CLIENT_NAME           = Guruvayur Estates
VILLA_NAME            = Guruvayur Villa (Dwarka)
VILLA_ID              = dwarka
ADDRESS               = Edappully Gandhinagar Rd, Palayoor, Guruvayur, Kerala 680101

# ── CONTACT NUMBERS ──────────────────────────────────────────
PHONE_1               = +91 99950 43283     # Villa landline / main
PHONE_2               = +91 97287 65101     # Owner mobile (operations)
GUEST_CONTACT_PHONE   = +91 97287 65101     # Number shown to guests for queries
                                             # Change this if you have a dedicated
                                             # guest relations number

# ── EMAIL ────────────────────────────────────────────────────
OWNER_EMAIL           = kerala.luxuryvillas@gmail.com   # Receives all alerts + guest forms
OWNER_EMAIL_CC        = bijisukumar@gmail.com            # CC on all owner emails

# ── GOOGLE DRIVE ─────────────────────────────────────────────
DRIVE_ROOT_ID         = 1NglE0BgsxS4wULHuO2N0ydFIErk6rrf2
# Folder structure created automatically:
# StayOps/ (DRIVE_ROOT_ID)
#   └── Guests/
#         └── YYYY/
#               └── MM-Mon/
#                     └── GuestName-DD-StayID/
#                           ├── GuestInfo-StayID.txt
#                           └── ID-StayID-timestamp.jpg

# ── GOOGLE SHEETS ─────────────────────────────────────────────
SPREADSHEET_ID        = 1Lt1aORPlrisE_4-DobQCecvlyH0yOsD2SAIgJLgyEo0

# ── WORKER / API ──────────────────────────────────────────────
WORKER_URL            = https://manage.luxuryvillasofguruvayur.com/api
# D1 Database ID      = 6047aa03-9893-4fd9-8ba2-b3d7f5264ed1  (bgindia-db)
# D1 Estates DB ID    = 6e23cb84-d341-4b2e-8062-e8244844309d  (bgindiadb-estates)

# ── APPS SCRIPT ───────────────────────────────────────────────
# GuestFormScript     = bound to Registration Response Sheet
# PollNewReservation  = kerala.luxuryvillas@gmail.com account
# SYSTEM_TOKEN        = stored in Cloudflare encrypted secrets
#                       AND in Apps Script Script Properties

# ── CHECK-IN FORM ─────────────────────────────────────────────
CHECKIN_SUBDOMAIN     = https://checkin.luxuryvillasofguruvayur.com
# Partner tokens (checkin_links table):
#   gvr-direct    → direct
#   gvr-airbnb    → airbnb
#   gvr-mmt       → makemytrip
#   gvr-booking   → booking
#   gvr-goibibo   → goibibo

# ── TRIGGER SCHEDULE ──────────────────────────────────────────
# processPendingCheckInForms  → every 5 minutes (GuestFormScript)
# pollNewReservations         → every 5 minutes (PollNewReservationAndProcess)

# ── BREAKFAST PRICING ─────────────────────────────────────────
BREAKFAST_PRICE_PER_PERSON = 275   # INR
BREAKFAST_OPTIONS          = Idli, Puttu, Appam

# ── RAMAN COMMISSION ──────────────────────────────────────────
RAMAN_COMMISSION_SINGLE_NIGHT  = 1000   # INR
RAMAN_COMMISSION_MULTI_NIGHT   = 2000   # INR

# ── CHECK-IN POLICY ───────────────────────────────────────────
STANDARD_CHECKIN_TIME   = 16:00   # 4:00 PM
STANDARD_CHECKOUT_TIME  = 11:00   # 11:00 AM
