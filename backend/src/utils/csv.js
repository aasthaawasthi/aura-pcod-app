// Minimal, dependency-free CSV serializer for the account-data export.
// Rows are plain flat objects (already flattened by the caller - nested
// arrays/objects should be joined into a single string before they get
// here, same as getAllUserDataForExport does for symptoms/goals/regions).

function escapeCsvCell(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Quote anything that could otherwise break column/row boundaries, and
  // double up any quotes already in the value (the standard CSV escape).
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Turns an array of flat objects into a CSV string. Column order follows
// the keys of the first row (or `columns`, if the caller wants a fixed
// order even when a table is empty - an empty export should still open
// as a valid CSV with just a header row, not a blank file).
function toCsv(rows, columns) {
  const cols = columns || (rows[0] ? Object.keys(rows[0]) : []);
  const lines = [cols.map(escapeCsvCell).join(",")];
  for (const row of rows) {
    lines.push(cols.map((c) => escapeCsvCell(row[c])).join(","));
  }
  return lines.join("\r\n");
}

module.exports = { toCsv };
