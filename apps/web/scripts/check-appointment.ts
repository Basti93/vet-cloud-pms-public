import postgres from "postgres";

const appointmentId = process.argv[2];
if (!appointmentId) {
  console.error("Usage: tsx scripts/check-appointment.ts <appointment-id>");
  process.exit(1);
}

const client = postgres(process.env.DATABASE_URL!);

(async () => {
  try {
    const appointment = await client`
      SELECT 
        a.id,
        a.source,
        a.status,
        a.start_time,
        a.tenant_id,
        a.patient_id,
        p.name as patient_name,
        p.owner_id,
        o.first_name,
        o.last_name,
        a.created_at
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN owners o ON p.owner_id = o.id
      WHERE a.id = ${appointmentId}
    `;
    
    console.log('Appointment details:');
    console.table(appointment);
    await client.end();
    process.exit(0);
  } catch (err: any) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
