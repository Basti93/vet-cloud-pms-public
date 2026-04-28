import postgres from "postgres";

const tenantId = process.argv[2];
if (!tenantId) {
  console.error("Usage: tsx scripts/check-booking-query.ts <tenant-id>");
  process.exit(1);
}

const client = postgres(process.env.DATABASE_URL!);

(async () => {
  try {
    const bookings = await client`
      SELECT 
        a.id,
        a.start_time,
        a.end_time,
        a.title,
        a.status,
        a.created_at,
        a.vet_id,
        p.id as patient_id,
        p.name as patient_name,
        p.species,
        p.breed,
        o.id as owner_id,
        o.first_name,
        o.last_name,
        o.email,
        o.phone
      FROM appointments a
      INNER JOIN patients p ON a.patient_id = p.id
      INNER JOIN owners o ON p.owner_id = o.id
      WHERE a.tenant_id = ${tenantId}
      AND a.source = 'online_booking'
    `;
    
    console.log(`Found ${bookings.length} bookings for tenant ${tenantId}:`);
    console.table(bookings);
    await client.end();
    process.exit(0);
  } catch (err: any) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
