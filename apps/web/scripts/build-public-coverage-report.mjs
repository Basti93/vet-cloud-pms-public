import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const coverageDir = path.join(appRoot, 'coverage');
const publicDir = path.join(appRoot, 'coverage-public');
const summaryPath = path.join(coverageDir, 'coverage-summary.json');

const metricNames = ['lines', 'statements', 'functions', 'branches'];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatPct(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '0.00';
  }

  return value.toFixed(2);
}

function metricCells(entry) {
  return metricNames
    .map((metricName) => {
      const metric = entry[metricName] ?? { pct: 0, covered: 0, total: 0 };
      return `<td><strong>${formatPct(metric.pct)}%</strong><span>${metric.covered}/${metric.total}</span></td>`;
    })
    .join('');
}

function relativeCoveragePath(filePath) {
  const relativePath = path.relative(appRoot, filePath);

  if (relativePath.startsWith('..')) {
    return path.basename(filePath);
  }

  return relativePath;
}

function renderMetricCard(name, metric) {
  return `
    <section class="metric">
      <span>${escapeHtml(name)}</span>
      <strong>${formatPct(metric.pct)}%</strong>
      <small>${metric.covered}/${metric.total}</small>
    </section>`;
}

function renderHtml(summary) {
  const generatedAt = new Date().toISOString();
  const entries = Object.entries(summary)
    .filter(([key]) => key !== 'total')
    .map(([filePath, entry]) => ({
      filePath: relativeCoveragePath(filePath),
      entry,
    }))
    .sort((a, b) => a.filePath.localeCompare(b.filePath));

  const total = summary.total;

  if (!total) {
    throw new Error('coverage-summary.json does not contain a total coverage entry');
  }

  const rows = entries
    .map(
      ({ filePath, entry }) => `
        <tr>
          <th scope="row">${escapeHtml(filePath)}</th>
          ${metricCells(entry)}
        </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Vet Cloud PMS Coverage</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f6f7f9;
        --panel: #ffffff;
        --text: #17202a;
        --muted: #5f6c7b;
        --line: #d9dee7;
        --accent: #087f8c;
        --accent-soft: #d9f0f2;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif;
        line-height: 1.5;
      }

      main {
        width: min(1180px, calc(100% - 32px));
        margin: 0 auto;
        padding: 40px 0;
      }

      header {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        align-items: end;
        margin-bottom: 28px;
      }

      h1 {
        margin: 0;
        font-size: 32px;
        line-height: 1.15;
      }

      p {
        margin: 8px 0 0;
        color: var(--muted);
      }

      .generated {
        color: var(--muted);
        font-size: 14px;
        text-align: right;
        white-space: nowrap;
      }

      .metrics {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        margin-bottom: 24px;
      }

      .metric {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
        padding: 16px;
      }

      .metric span,
      .metric small {
        display: block;
        color: var(--muted);
      }

      .metric strong {
        display: block;
        margin: 6px 0 2px;
        color: var(--accent);
        font-size: 28px;
        line-height: 1;
      }

      .table-wrap {
        overflow-x: auto;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
      }

      table {
        width: 100%;
        min-width: 760px;
        border-collapse: collapse;
      }

      th,
      td {
        padding: 12px 14px;
        border-bottom: 1px solid var(--line);
        text-align: left;
        vertical-align: top;
      }

      thead th {
        background: var(--accent-soft);
        color: #123b40;
        font-size: 13px;
        text-transform: uppercase;
      }

      tbody tr:last-child th,
      tbody tr:last-child td {
        border-bottom: 0;
      }

      tbody th {
        width: 48%;
        font-weight: 600;
        overflow-wrap: anywhere;
      }

      td strong,
      td span {
        display: block;
      }

      td span {
        color: var(--muted);
        font-size: 13px;
      }

      @media (max-width: 760px) {
        main {
          width: min(100% - 20px, 1180px);
          padding: 24px 0;
        }

        header {
          display: block;
        }

        .generated {
          margin-top: 12px;
          text-align: left;
          white-space: normal;
        }

        .metrics {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <h1>Vet Cloud PMS Coverage</h1>
          <p>Public-safe aggregate coverage summary. Source-level reports remain private in GitHub Actions artifacts.</p>
        </div>
        <div class="generated">Generated ${escapeHtml(generatedAt)}</div>
      </header>

      <section class="metrics" aria-label="Total coverage">
        ${renderMetricCard('Lines', total.lines)}
        ${renderMetricCard('Statements', total.statements)}
        ${renderMetricCard('Functions', total.functions)}
        ${renderMetricCard('Branches', total.branches)}
      </section>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">File</th>
              <th scope="col">Lines</th>
              <th scope="col">Statements</th>
              <th scope="col">Functions</th>
              <th scope="col">Branches</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </main>
  </body>
</html>`;
}

const summary = JSON.parse(await readFile(summaryPath, 'utf8'));
const html = renderHtml(summary);

await rm(publicDir, { recursive: true, force: true });
await mkdir(publicDir, { recursive: true });
await writeFile(path.join(publicDir, 'index.html'), html);

console.log(`Public coverage report written to ${path.relative(appRoot, publicDir)}/index.html`);
