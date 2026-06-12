// ============================================================
//  SCHEMA CONTRACTS
//  Defines what columns each worker action reads or writes.
//  Used by SchemaValidation screen to cross-check against
//  the live DB schema snapshot.
//
//  HOW TO MAINTAIN:
//  When you add/change a worker query, update this file too.
//  The validation screen will catch any drift automatically.
// ============================================================

export const CONTRACTS = [
  // ── STAYS TABLE ─────────────────────────────────────────

  {
    action: 'getUpcomingStays',
    table: 'stays',
    type: 'SELECT',
    columns: [
      'stay_id','guest_name','guest_phone','guest_email',
      'checkin_date','checkout_date','nights','adults','children',
      'source','status','villa_id','from_city',
      'drive_folder_id','drive_folder_url',
      'tariff_per_night','extra_charges','extra_lines','gross','net','notes',
      'commission_pct','commission_amt',
      'night_fee','cleaning_fee','host_service_fee','you_earn',
      'guest_service_fee','guest_paid_total',
      'airbnb_conf','folder_created',
      'request_early_checkin','request_late_checkout',
      'request_breakfast','breakfast_choice','request_cab',
      'request_extra_beds','extra_beds_count',
      'nationality','purpose_of_visit','mode_of_transport','eta',
    ],
  },
  {
    action: 'getStays',
    table: 'stays',
    type: 'SELECT',
    columns: ['*'], // SELECT * — all columns
  },
  {
    action: 'getPendingReviewStays',
    table: 'stays',
    type: 'SELECT',
    columns: [
      'stay_id','guest_name','checkin_date','checkout_date','nights',
      'guest_phone','guest_email','drive_folder_url','drive_folder_id',
      'created_at','folder_created','folder_created_at',
    ],
  },
  {
    action: 'findOpenStay',
    table: 'stays',
    type: 'SELECT',
    columns: [
      'stay_id','guest_name','checkin_date','checkout_date','nights','adults','children',
      'guest_phone','guest_email','drive_folder_id','drive_folder_url','status',
      'purpose_of_visit','mode_of_transport','vehicle_number','eta','nationality',
      'city','state','country','request_early_checkin','request_late_checkout',
      'request_breakfast','breakfast_choice','request_cab','govt_id_type','govt_id_num',
    ],
  },
  {
    action: 'submitGuestCheckIn (UPDATE)',
    table: 'stays',
    type: 'UPDATE',
    columns: [
      'guest_phone','guest_email','dob','gender','nationality',
      'home_address','city','state','country','from_city','pincode','home_country_address',
      'checkout_date','nights','adults','children',
      'guest_list','purpose_of_visit','mode_of_transport','vehicle_number','eta',
      'govt_id_type','govt_id_num',
      'passport_number','passport_issue_date','passport_issue_place','passport_expiry',
      'visa_number','visa_type','visa_issue_date','visa_issue_place',
      'arrival_date_india','port_of_arrival','next_destination',
      'request_early_checkin','request_late_checkout','request_breakfast',
      'breakfast_choice','request_cab','request_extra_beds','extra_beds_count',
      'source','checkin_form_submitted','checkin_form_submitted_at',
      'status','updated_by','updated_at',
    ],
  },
  {
    action: 'submitGuestCheckIn (INSERT)',
    table: 'stays',
    type: 'INSERT',
    columns: [
      'stay_id','villa_id','source','guest_name','guest_phone','guest_email',
      'checkin_date','checkout_date','nights','adults','children','gross','net',
      'dob','gender','nationality',
      'home_address','city','state','country','from_city','pincode','home_country_address',
      'guest_list','purpose_of_visit','mode_of_transport','vehicle_number','eta',
      'govt_id_type','govt_id_num',
      'passport_number','passport_issue_date','passport_issue_place','passport_expiry',
      'visa_number','visa_type','visa_issue_date','visa_issue_place',
      'arrival_date_india','port_of_arrival','next_destination',
      'request_early_checkin','request_late_checkout','request_breakfast',
      'breakfast_choice','request_cab','request_extra_beds','extra_beds_count',
      'checkin_form_submitted','status','created_by','updated_by',
    ],
  },
  {
    action: 'createBooking (UPDATE provisional)',
    table: 'stays',
    type: 'UPDATE',
    columns: [
      'source','airbnb_conf','gross','commission_pct','commission_amt','net',
      'night_fee','cleaning_fee','host_service_fee','you_earn',
      'guest_service_fee','guest_paid_total','checkout_date','nights','adults',
      'updated_by','updated_at',
    ],
  },
  {
    action: 'createBooking (INSERT)',
    table: 'stays',
    type: 'INSERT',
    columns: [
      'stay_id','villa_id','source','guest_name','guest_phone','guest_email',
      'checkin_date','checkout_date','nights','adults','children',
      'tariff_per_night','extra_charges','gross','commission_pct','commission_amt','net',
      'status','home_address','city','state','country','from_city',
      'night_fee','cleaning_fee','host_service_fee','you_earn',
      'guest_service_fee','guest_paid_total','airbnb_conf','created_by','updated_by',
    ],
  },
  {
    action: 'saveVillaRentalIncome',
    table: 'stays',
    type: 'UPDATE',
    columns: [
      'source','tariff_per_night','extra_charges','extra_lines','gross',
      'commission_pct','commission_amt','net',
      'night_fee','cleaning_fee','host_service_fee','you_earn',
      'guest_service_fee','guest_paid_total','updated_by','updated_at',
    ],
  },
  {
    action: 'updateDriveFolder',
    table: 'stays',
    type: 'UPDATE',
    columns: [
      'drive_folder_id','drive_folder_url','folder_created',
      'folder_created_at','processing_log','updated_by','updated_at',
    ],
  },
  {
    action: 'updateStayStatus',
    table: 'stays',
    type: 'UPDATE',
    columns: ['status','updated_by','updated_at'],
  },
  {
    action: 'saveReview',
    table: 'stays',
    type: 'UPDATE',
    columns: [
      'review_rating','review_source','review_date',
      'review_text','review_note','review_highlights','updated_by','updated_at',
    ],
  },
  {
    action: 'markReviewChased',
    table: 'stays',
    type: 'UPDATE',
    columns: ['review_chased_at','review_chase_count','updated_by','updated_at'],
  },
  {
    action: 'closeStayWithReview',
    table: 'stays',
    type: 'UPDATE',
    columns: ['status','review_rating','review_source','review_date','updated_by','updated_at'],
  },
  {
    action: 'getReviewChaseList',
    table: 'stays',
    type: 'SELECT',
    columns: [
      'stay_id','guest_name','checkin_date','checkout_date','nights','adults',
      'source','guest_phone','review_rating','review_date',
      'review_chased_at','review_chase_count',
    ],
  },
  {
    action: 'getVillaDashboard',
    table: 'stays',
    type: 'SELECT',
    columns: ['stay_id','guest_name','checkin_date','checkout_date','nights','adults','source','net','gross','commission_amt','status','from_city','city','state','country'],
  },

  // ── GUEST_DOCUMENTS TABLE ────────────────────────────────

  {
    action: 'getGuestDocuments',
    table: 'guest_documents',
    type: 'SELECT',
    columns: ['doc_id','stay_id','doc_type','file_name','file_b64','folder_created'],
  },
  {
    action: 'getDocumentStatus',
    table: 'guest_documents',
    type: 'SELECT',
    columns: ['doc_id','stay_id','doc_type','file_name','folder_created','created_at','updated_at'],
  },
  {
    action: 'submitGuestCheckIn (INSERT docs)',
    table: 'guest_documents',
    type: 'INSERT',
    columns: ['doc_id','stay_id','doc_type','file_name','file_b64','folder_created','created_at'],
  },
  {
    action: 'markDocumentUploaded',
    table: 'guest_documents',
    type: 'UPDATE',
    columns: ['folder_created','updated_at'],
  },
  {
    action: 'cleanupExpiredDocuments',
    table: 'guest_documents',
    type: 'DELETE',
    columns: ['folder_created','created_at'],
  },

  // ── OTHER TABLES ─────────────────────────────────────────

  {
    action: 'confirmCheckIn / checkOut',
    table: 'raman_commissions',
    type: 'INSERT',
    columns: ['comm_id','stay_id','guest_name','checkin_date','nights','commission','is_paid','created_by','updated_by','created_at','updated_at'],
  },
  {
    action: 'resolveCheckinLink',
    table: 'checkin_links',
    type: 'SELECT',
    columns: ['token','villa_id','partner','label','is_active'],
  },
  {
    action: 'getTenantConfig',
    table: 'tenants',
    type: 'SELECT',
    columns: ['tenant_id','villa_name','phone1','phone2','guest_contact','address','checkin_time','checkout_time','owner_email','owner_email_cc','drive_root_id','breakfast_rate','raman_comm_pct'],
  },
  {
    action: 'saveBreakfastEntry',
    table: 'guest_requests',
    type: 'INSERT',
    columns: ['req_id','stay_id','type','detail','status','created_by','updated_by','created_at','updated_at'],
  },
  {
    action: 'getInventory',
    table: 'inventory',
    type: 'SELECT',
    columns: ['item_id','villa_id','name','unit','category','qty_in_stock','cost_price','sell_price','last_restocked'],
  },
]

// Tables that must exist in the live DB
export const REQUIRED_TABLES = [
  'stays', 'guest_documents', 'guest_requests', 'stay_cars',
  'stay_incidentals', 'inventory', 'raman_commissions',
  'rental_props', 'rental_income', 'checkin_links',
  'tenants', 'auth_tokens', 'duplicate_bookings',
  'property_details', 'property_documents',
]
