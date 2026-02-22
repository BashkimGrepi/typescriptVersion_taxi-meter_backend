//simple HTML builder for the payments export PDF


export function buildPaymentsHtml(snapshot: any) {
    const { meta, vat, payments, exceptions } = snapshot;

    const esc = (s: any) =>
        String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    
    const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleString('fi-FI') : '—');
    const money = (s?: string) => (s ?? '0.00');

    //VAT summary table rows (by rate)
    const vatRows = (vat?.summaryByRate ?? [])
    .map((r: any) => `
      <tr>
        <td>${(Number(r.rate) * 100).toFixed(0)}%</td>
        <td class="num">${esc(r.base)}</td>
        <td class="num">${esc(r.tax)}</td>
        <td class="num">${esc(r.total)}</td>
        <td class="num">${esc(r.count)}</td>
      </tr>
    `).join('');
        
    // Payment details rows
  const payRows = (payments ?? [])
    .map((p: any) => `
      <tr>
        <td>${esc(p.receiptNumber ?? '—')}</td>
        <td>${fmtDate(p.capturedAt)}</td>
        <td>${fmtDate(p.serviceDate)}</td>
        <td>${esc(p.description ?? 'Passenger transport')}</td>
        <td class="num">${money(p.base)}</td>
        <td class="num">${money(p.tax)}</td>
        <td class="num">${money(p.total)}</td>
        <td>${(Number(p.rate) * 100).toFixed(0)}%</td>
        <td>${esc(p.method ?? '')}</td>
      </tr>
    `).join('');

  // Exceptions
  const exRides = (exceptions?.ridesWithoutPayments ?? [])
    .map((r: any) => `<li>Ride ${esc(r.rideId)} (ended ${fmtDate(r.endedAt)})</li>`).join('');
  const exPays = (exceptions?.paymentsWithoutRide ?? [])
    .map((p: any) => `<li>Payment ${esc(p.paymentId)} (captured ${fmtDate(p.capturedAt)})</li>`).join('');
  const exWarn = (exceptions?.warnings ?? [])
    .map((w: string) => `<li>${esc(w)}</li>`).join('');

  const title = `Payments export — ${esc(meta?.tenant?.name ?? '')}`;
  const period = `${esc(new Date(meta?.period?.from).toLocaleDateString('fi-FI'))} – ${esc(new Date(meta?.period?.to).toLocaleDateString('fi-FI'))}`;

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    @page {
      size: A4;
      margin: 16mm 14mm 16mm 14mm;
    }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size: 10.5pt; color: #111; }
    h1,h2,h3 { margin: 0 0 6px 0; }
    .muted { color: #555; }
    .chip { display:inline-block; padding:2px 8px; border:1px solid #ddd; border-radius: 999px; font-size: 9pt; }
    .section { margin: 14px 0 18px; }
    table { width: 100%; border-collapse: collapse; }
    thead th { text-align: left; border-bottom: 1px solid #999; padding: 6px 4px; background: #f8f8f8; position: sticky; top: 0; }
    tbody td { border-bottom: 1px solid #eee; padding: 6px 4px; vertical-align: top; }
    .num { text-align: right; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .card { border: 1px solid #e5e5e5; border-radius: 8px; padding: 10px; }
    .small { font-size: 9pt; }
    .break-avoid { page-break-inside: avoid; }
    .page-break { page-break-before: always; }
    footer { position: fixed; bottom: -10mm; left: 0; right: 0; font-size: 9pt; color: #666; }
  </style>
</head>
<body>
  <!-- Cover -->
  <div class="section break-avoid">
    <h1>${esc(meta?.tenant?.name ?? 'Company')}</h1>
    <div class="muted">Business ID: ${esc(meta?.tenant?.businessId ?? '—')}${meta?.tenant?.vatId ? ' · VAT ID: ' + esc(meta?.tenant?.vatId) : ''}</div>
    <div class="muted">Period: <span class="chip">${period}</span></div>
    <div class="small muted" style="margin-top:6px;">
      Generated: ${fmtDate(meta?.generatedAt)} · By: ${esc(meta?.generatedBy?.email ?? '')}<br/>
      Snapshot SHA-256: ${esc(snapshot.sha256 ?? '')}
    </div>
  </div>

  <!-- VAT summary -->
  <div class="section">
    <h2>VAT summary (by rate)</h2>
    <table>
      <thead>
        <tr>
          <th>Rate</th>
          <th class="num">Net (€)</th>
          <th class="num">VAT (€)</th>
          <th class="num">Total (€)</th>
          <th class="num">Count</th>
        </tr>
      </thead>
      <tbody>
        ${vatRows || `<tr><td colspan="5" class="muted">No paid payments in the period.</td></tr>`}
      </tbody>
    </table>
  </div>

  <!-- Details -->
  <div class="section">
    <h2>Payments (simplified receipts)</h2>
    <table>
      <thead>
        <tr>
          <th>Receipt #</th>
          <th>Captured</th>
          <th>Service date</th>
          <th>Description</th>
          <th class="num">Net</th>
          <th class="num">VAT</th>
          <th class="num">Total</th>
          <th>Rate</th>
          <th>Method</th>
        </tr>
      </thead>
      <tbody>
        ${payRows || `<tr><td colspan="9" class="muted">No rows.</td></tr>`}
      </tbody>
    </table>
  </div>

  <!-- Exceptions -->
  <div class="section page-break">
    <h2>Exceptions</h2>
    <div class="grid">
      <div class="card">
        <h3>Rides without PAID payments</h3>
        <ul class="small">${exRides || '<li>None</li>'}</ul>
      </div>
      <div class="card">
        <h3>Payments without Ride</h3>
        <ul class="small">${exPays || '<li>None</li>'}</ul>
      </div>
    </div>
    <div class="card" style="margin-top:12px;">
      <h3>Warnings</h3>
      <ul class="small">${exWarn || '<li>None</li>'}</ul>
    </div>
  </div>

  <footer>
    ${esc(meta?.tenant?.name ?? '')} · Payments export · ${esc(meta?.period?.yyyymm ?? '')}
  </footer>
</body>
</html>
  `;
}