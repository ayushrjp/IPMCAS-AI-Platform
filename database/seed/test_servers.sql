-- Seed initial measurement test servers
INSERT INTO test_servers (id, server_name, location_city, location_country, host_url, is_active)
VALUES 
  (gen_random_uuid(), 'AP-South-1 Primary Edge', 'Mumbai', 'IN', 'https://speed-mumbai.ipmcas.internal', true),
  (gen_random_uuid(), 'AP-South-2 Secondary Edge', 'Hyderabad', 'IN', 'https://speed-hyderabad.ipmcas.internal', true)
ON CONFLICT DO NOTHING;
