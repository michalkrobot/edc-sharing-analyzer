# Multi EAN Analyzer

A simple browser app for EDC CSV analysis with support for multiple production EAN.

## Files

- `multi-ean-analyzer.html`
- `multi-ean-analyzer.css`
- `multi-ean-analyzer.js`

## Run

1. Open `multi-ean-analyzer.html` in your browser.
2. Upload your EDC CSV report.
3. Set allocation and cost for each consumer EAN.
4. Use `Simulovat sdileni` or `Najit optimalni alokace`.

## Notes

- Designed for multiple producer EAN (`-D`) and multiple consumer EAN (`-O`).
- Allocation constraints: sum of consumer allocations must be <= 100%.
- Simulation uses all producer energy combined per interval.
