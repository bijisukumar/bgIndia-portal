-- Master Booking Sheet Seed (Direct + Booking.com)
-- Run AFTER seed-airbnb.sql

BEGIN TRANSACTION;

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2026-M0200', 'dwarka', 'direct', 'AjayRao', '2026-01-22', '2026-01-24', 2, 14500.00, 0, 0.00, 14500.00, 'closed', '2026-01-22T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2026-M0201', 'dwarka', 'direct', 'Aswin A', '2026-02-11', '2026-02-12', 1, 9000.00, 0, 0.00, 9000.00, 'closed', '2026-02-11T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0202', 'dwarka', 'booking_com', 'Parvathy Ramasamy', '2022-02-04', '2022-02-05', 1, 7930.00, 15, 1189.50, 6740.50, 'closed', '2022-02-04T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0203', 'dwarka', 'booking_com', 'V, Soma', '2022-04-22', '2022-04-24', 2, 14275.00, 15, 2141.25, 12133.75, 'closed', '2022-04-22T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0204', 'dwarka', 'booking_com', 'pillai, mahesh', '2022-05-02', '2022-05-03', 1, 5950.00, 15, 892.50, 5057.50, 'closed', '2022-05-02T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0205', 'dwarka', 'booking_com', 'Gurumurthy, Ganesan', '2022-05-07', '2022-05-08', 1, 13000.00, 15, 1950.00, 11050.00, 'closed', '2022-05-07T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0206', 'dwarka', 'booking_com', 'P.J, Jimjos', '2022-05-07', '2022-05-09', 2, 9000.00, 15, 1350.00, 7650.00, 'closed', '2022-05-07T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0207', 'dwarka', 'booking_com', 'Kam, Pranesh', '2022-05-08', '2022-05-09', 1, 4500.00, 15, 675.00, 3825.00, 'closed', '2022-05-08T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0208', 'dwarka', 'booking_com', 'Toppian, Abhishek', '2022-05-14', '2022-05-15', 1, 7187.50, 15, 1078.12, 6109.38, 'closed', '2022-05-14T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0209', 'dwarka', 'booking_com', 'narayan, prakashan', '2022-05-19', '2022-05-20', 1, 4750.00, 15, 712.50, 4037.50, 'closed', '2022-05-19T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0210', 'dwarka', 'booking_com', 'Mohanraj, Parthasarathy', '2022-05-21', '2022-05-22', 1, 10000.00, 15, 1500.00, 8500.00, 'closed', '2022-05-21T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0211', 'dwarka', 'booking_com', 'Guest House, Sri Ram', '2022-05-21', '2022-05-22', 1, 5850.00, 15, 877.50, 4972.50, 'closed', '2022-05-21T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0212', 'dwarka', 'booking_com', 'Sajith, Sebastian', '2022-05-25', '2022-05-29', 4, 20800.00, 15, 3120.00, 17680.00, 'closed', '2022-05-25T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0213', 'dwarka', 'booking_com', 'Sachin, Anju', '2022-06-01', '2022-06-02', 1, 10000.00, 15, 1500.00, 8500.00, 'closed', '2022-06-01T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0214', 'dwarka', 'booking_com', 'Surendran, Prasoon', '2022-06-07', '2022-06-09', 2, 21700.00, 15, 3255.00, 18445.00, 'closed', '2022-06-07T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0215', 'dwarka', 'booking_com', 'Nair, Soman Rajiv', '2022-06-12', '2022-06-13', 1, 5500.00, 15, 825.00, 4675.00, 'closed', '2022-06-12T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0216', 'dwarka', 'booking_com', 'Saraswati, Nagabala', '2022-06-14', '2022-06-16', 2, 12375.00, 15, 1856.25, 10518.75, 'closed', '2022-06-14T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0217', 'dwarka', 'booking_com', 'Kumar, Dileep', '2022-07-23', '2022-07-24', 1, 12250.00, 15, 1837.50, 10412.50, 'closed', '2022-07-23T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0218', 'dwarka', 'booking_com', 'Naresh Kumar', '2022-07-29', '2022-08-01', 3, 24100.00, 15, 3615.00, 20485.00, 'closed', '2022-07-29T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0219', 'dwarka', 'booking_com', 'Ravindra Bhide', '2022-08-08', '2022-08-10', 2, 22240.00, 15, 3336.00, 18904.00, 'closed', '2022-08-08T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0220', 'dwarka', 'direct', 'Mathi', '2022-08-14', '2022-08-16', 2, 0.00, 0, 0.00, 0.00, 'closed', '2022-08-14T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0221', 'dwarka', 'booking_com', 'Arvindakumar Sundaraj', '2022-08-14', '2022-08-16', 2, 18405.00, 15, 2760.75, 15644.25, 'closed', '2022-08-14T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0222', 'dwarka', 'booking_com', 'Rajendran Rajamanickam', '2022-08-17', '2022-08-18', 1, 5900.00, 15, 885.00, 5015.00, 'closed', '2022-08-17T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0223', 'dwarka', 'booking_com', 'Manikanda Prabhu G', '2022-08-22', '2022-08-23', 1, 6040.00, 15, 906.00, 5134.00, 'closed', '2022-08-22T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0224', 'dwarka', 'booking_com', 'Bijoy Nair', '2022-08-23', '2022-08-25', 2, 14860.00, 15, 2229.00, 12631.00, 'closed', '2022-08-23T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0225', 'dwarka', 'booking_com', 'Ajith Kunnath', '2022-08-23', '2022-08-24', 1, 6600.00, 15, 990.00, 5610.00, 'closed', '2022-08-23T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0226', 'dwarka', 'booking_com', 'Prince Paul', '2022-08-23', '2022-08-29', 6, 57551.50, 15, 8632.73, 48918.77, 'closed', '2022-08-23T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0227', 'dwarka', 'booking_com', 'Govindaraj Ramaswamy', '2022-08-28', '2022-08-29', 1, 9260.00, 15, 1389.00, 7871.00, 'closed', '2022-08-28T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0228', 'dwarka', 'booking_com', 'Bakal Ragavendra Shenoy', '2022-09-01', '2022-09-04', 3, 17800.00, 15, 2670.00, 15130.00, 'closed', '2022-09-01T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0229', 'dwarka', 'booking_com', 'Subra Mani Ganesan', '2022-09-14', '2022-09-15', 1, 7930.00, 15, 1189.50, 6740.50, 'closed', '2022-09-14T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0230', 'dwarka', 'booking_com', 'Sravan kola', '2022-10-06', '2022-10-08', 2, 17520.00, 15, 2628.00, 14892.00, 'closed', '2022-10-06T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0231', 'dwarka', 'booking_com', 'Mohammed S', '2022-10-09', '2022-10-13', 4, 18640.00, 15, 2796.00, 15844.00, 'closed', '2022-10-09T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0232', 'dwarka', 'booking_com', 'Vipinkalady das', '2022-10-10', '2022-10-11', 1, 15602.50, 15, 2340.38, 13262.12, 'closed', '2022-10-10T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0233', 'dwarka', 'booking_com', 'Ravi Viswanathan', '2022-10-14', '2022-10-16', 2, 17380.00, 15, 2607.00, 14773.00, 'closed', '2022-10-14T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0234', 'dwarka', 'booking_com', 'Jegadeesh Kumar Chellappan Pillai', '2022-10-22', '2022-10-23', 1, 5410.00, 15, 811.50, 4598.50, 'closed', '2022-10-22T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0235', 'dwarka', 'booking_com', 'Hariharan Narayanan', '2022-10-22', '2022-10-23', 1, 6600.00, 15, 990.00, 5610.00, 'closed', '2022-10-22T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0236', 'dwarka', 'booking_com', 'Manikanda Prabhu G', '2022-10-22', '2022-10-23', 1, 6040.00, 15, 906.00, 5134.00, 'closed', '2022-10-22T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0237', 'dwarka', 'booking_com', 'Parthiban Ramanujam', '2022-10-23', '2022-10-24', 1, 6040.00, 15, 906.00, 5134.00, 'closed', '2022-10-23T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0238', 'dwarka', 'booking_com', 'Nair Bijoy', '2022-10-23', '2022-10-25', 2, 14860.00, 15, 2229.00, 12631.00, 'closed', '2022-10-23T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0239', 'dwarka', 'booking_com', 'RAMNATH SUSENDRAN', '2022-10-29', '2022-10-30', 1, 6040.00, 15, 906.00, 5134.00, 'closed', '2022-10-29T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0240', 'dwarka', 'booking_com', 'brijesh balakrishnan', '2022-10-31', '2022-11-01', 1, 6600.00, 15, 990.00, 5610.00, 'closed', '2022-10-31T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0241', 'dwarka', 'direct', 'Usha Raju', '2022-11-02', '2022-11-06', 4, 33500.00, 0, 0.00, 33500.00, 'closed', '2022-11-02T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0242', 'dwarka', 'booking_com', 'ROOPCHARAN AGARWAL', '2022-11-08', '2022-11-09', 1, 14688.00, 15, 2203.20, 12484.80, 'closed', '2022-11-08T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0243', 'dwarka', 'booking_com', 'Mae Borio', '2022-11-10', '2022-11-11', 1, 9038.80, 15, 1355.82, 7682.98, 'closed', '2022-11-10T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0244', 'dwarka', 'booking_com', 'Satheesh Nair', '2022-11-21', '2022-11-22', 1, 7316.80, 15, 1097.52, 6219.28, 'closed', '2022-11-21T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0245', 'dwarka', 'booking_com', 'Kuzalmannam Raman', '2022-11-22', '2022-11-23', 1, 10150.90, 15, 1522.63, 8628.27, 'closed', '2022-11-22T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0246', 'dwarka', 'booking_com', 'Iman Acharya', '2022-11-25', '2022-11-27', 2, 9820.00, 15, 1473.00, 8347.00, 'closed', '2022-11-25T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0247', 'dwarka', 'booking_com', 'Acharya, Iman', '2022-11-25', '2022-11-27', 2, 8875.00, 15, 1331.25, 7543.75, 'closed', '2022-11-25T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0248', 'dwarka', 'booking_com', 'Prabhu Subramani', '2022-11-26', '2022-11-27', 1, 6684.00, 15, 1002.60, 5681.40, 'closed', '2022-11-26T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0249', 'dwarka', 'booking_com', 'Mohan P', '2022-12-01', '2022-12-03', 2, 22181.00, 15, 3327.15, 18853.85, 'closed', '2022-12-01T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0250', 'dwarka', 'booking_com', 'Deepu Rambeth', '2022-12-03', '2022-12-04', 1, 12180.50, 15, 1827.08, 10353.42, 'closed', '2022-12-03T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0251', 'dwarka', 'booking_com', 'Tina Balachandran', '2022-12-16', '2022-12-17', 1, 17225.00, 15, 2583.75, 14641.25, 'closed', '2022-12-16T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0252', 'dwarka', 'booking_com', 'Krishnakumar Kalamegam', '2022-12-21', '2022-12-24', 3, 28001.35, 15, 4200.20, 23801.15, 'closed', '2022-12-21T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0253', 'dwarka', 'booking_com', 'Yoganand Srinivasan', '2022-12-24', '2022-12-25', 1, -8616.00, 15, -1292.40, -7323.60, 'closed', '2022-12-24T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0254', 'dwarka', 'booking_com', 'Paras Desai', '2022-12-25', '2022-12-26', 1, 17077.60, 15, 2561.64, 14515.96, 'closed', '2022-12-25T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0255', 'dwarka', 'booking_com', 'Rajalakshmi PR', '2022-12-27', '2022-12-29', 2, -19821.00, 15, -2973.15, -16847.85, 'closed', '2022-12-27T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2022-M0256', 'dwarka', 'booking_com', 'Ruchi Chopra', '2022-12-30', '2022-12-31', 1, 7406.40, 15, 1110.96, 6295.44, 'closed', '2022-12-30T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2023-M0257', 'dwarka', 'booking_com', 'Gaya Venkataraman', '2023-01-03', '2023-01-05', 2, 19000.90, 15, 2850.14, 16150.76, 'closed', '2023-01-03T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2023-M0258', 'dwarka', 'direct', 'Eash', '2023-01-06', '2023-01-07', 1, 0.00, 0, 0.00, 0.00, 'closed', '2023-01-06T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2023-M0259', 'dwarka', 'booking_com', 'Deeksha Poornachandran', '2023-01-25', '2023-01-26', 1, 17938.90, 15, 2690.84, 15248.06, 'closed', '2023-01-25T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2023-M0260', 'dwarka', 'booking_com', 'Gokulprasath Balajiprasath', '2023-01-26', '2023-01-27', 1, 11540.35, 15, 1731.05, 9809.30, 'closed', '2023-01-26T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2023-M0261', 'dwarka', 'booking_com', 'Sisira Kanhirathingal', '2023-01-30', '2023-02-01', 2, -28376.00, 15, -4256.40, -24119.60, 'closed', '2023-01-30T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2023-M0262', 'dwarka', 'booking_com', 'Prasanna Narayanan', '2023-02-11', '2023-02-12', 1, 0.00, 15, 0.00, 0.00, 'closed', '2023-02-11T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2023-M0263', 'dwarka', 'booking_com', 'Myles Hallin', '2023-02-13', '2023-02-15', 2, 19821.00, 15, 2973.15, 16847.85, 'closed', '2023-02-13T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2023-M0264', 'dwarka', 'booking_com', 'Aparna', '2023-02-06', '2023-02-08', 2, 8439.00, 15, 1265.85, 7173.15, 'closed', '2023-02-06T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2023-M0265', 'dwarka', 'booking_com', 'Rama Chandran', '2023-03-10', '2023-03-11', 1, 0.00, 15, 0.00, 0.00, 'closed', '2023-03-10T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2023-M0266', 'dwarka', 'booking_com', 'Raghavan Kumar', '2023-03-23', '2023-03-24', 1, 9508.00, 15, 1426.20, 8081.80, 'closed', '2023-03-23T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2023-M0267', 'dwarka', 'direct', 'Janaki Ram', '2023-04-01', '2023-04-03', 2, 22000.00, 0, 0.00, 22000.00, 'closed', '2023-04-01T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2023-M0268', 'dwarka', 'booking_com', 'Preethi Myla', '2023-04-04', '2023-04-05', 1, 8207.20, 15, 1231.08, 6976.12, 'closed', '2023-04-04T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2023-M0269', 'dwarka', 'direct', 'MadanP Murughasan Rajathi', '2023-04-23', '2023-04-24', 1, 29731.50, 0, 0.00, 29731.50, 'closed', '2023-04-23T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2023-M0270', 'dwarka', 'booking_com', 'Manju P', '2023-04-25', '2023-04-26', 1, 16950.00, 15, 2542.50, 14407.50, 'closed', '2023-04-25T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2023-M0271', 'dwarka', 'direct', 'Sujitha Naduvileveetil', '2023-06-10', '2023-06-12', 2, 0.00, 0, 0.00, 0.00, 'closed', '2023-06-10T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2023-M0272', 'dwarka', 'direct', 'Venkata Kidambi', '2023-06-23', '2023-06-24', 1, 13850.20, 0, 0.00, 13850.20, 'closed', '2023-06-23T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2023-M0273', 'dwarka', 'booking_com', 'Harishankar Valavanur', '2023-06-25', '2023-06-26', 1, 8056.00, 15, 1208.40, 6847.60, 'closed', '2023-06-25T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2023-M0274', 'dwarka', 'direct', 'Priyesh USA', '2023-07-15', '2023-07-16', 1, 13920.00, 0, 0.00, 13920.00, 'closed', '2023-07-15T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2023-M0275', 'dwarka', 'direct', 'Ashok Nair', '2023-08-10', '2023-08-11', 1, 12121.50, 0, 0.00, 12121.50, 'closed', '2023-08-10T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2023-M0276', 'dwarka', 'booking_com', 'Satish Narayanan', '2023-08-16', '2023-08-17', 1, 16576.00, 15, 2486.40, 14089.60, 'closed', '2023-08-16T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2023-M0277', 'dwarka', 'direct', 'Umesh Gangadhar', '2023-08-31', '2023-09-01', 1, 11780.00, 0, 0.00, 11780.00, 'closed', '2023-08-31T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2023-M0278', 'dwarka', 'booking_com', 'Rajshekhar Pullabhatla', '2023-09-01', '2023-09-04', 3, 23176.00, 15, 3476.40, 19699.60, 'closed', '2023-09-01T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2023-M0279', 'dwarka', 'direct', 'Laxmanan', '2023-09-14', '2023-09-15', 1, 28000.00, 0, 0.00, 28000.00, 'closed', '2023-09-14T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2023-M0280', 'dwarka', 'direct', 'Vinoth Kumar', '2023-09-22', '2023-09-24', 2, 12000.00, 0, 0.00, 12000.00, 'closed', '2023-09-22T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2023-M0281', 'dwarka', 'direct', 'Diksha Bommisetty', '2023-09-26', '2023-09-27', 1, 13000.00, 0, 0.00, 13000.00, 'closed', '2023-09-26T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2025-M0282', 'dwarka', 'direct', 'Saleh Thangal', '2025-05-09', '2025-05-11', 2, 0.00, 0, 0.00, 0.00, 'closed', '2025-05-09T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2025-M0283', 'dwarka', 'direct', 'Navar Reddy', '2025-01-25', '2025-01-26', 1, 0.00, 0, 0.00, 0.00, 'closed', '2025-01-25T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2025-M0284', 'dwarka', 'booking_com', 'Karthic Radhakrishnan', '2025-02-14', '2025-02-16', 2, 0.00, 15, 0.00, 0.00, 'closed', '2025-02-14T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2025-M0285', 'dwarka', 'booking_com', 'Vaisak Sasi', '2025-04-06', '2025-04-07', 1, 0.00, 15, 0.00, 0.00, 'closed', '2025-04-06T12:00:00');

INSERT OR IGNORE INTO stays (stay_id, villa_id, source, guest_name, checkin_date, checkout_date, nights, gross, commission_pct, commission_amt, net, status, created_at)
VALUES ('DWK-2025-M0286', 'dwarka', 'booking_com', 'Krishnamurti Anantanarayanam', '2025-05-02', '2025-05-04', 2, 0.00, 15, 0.00, 0.00, 'closed', '2025-05-02T12:00:00');

COMMIT;