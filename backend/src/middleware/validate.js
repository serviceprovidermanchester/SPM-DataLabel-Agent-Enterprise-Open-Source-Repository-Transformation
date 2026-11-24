"use strict";
function requireFields(body, fields) {
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null || String(body[f]).trim() === "") {
      const e = new Error("Missing required field: " + f); e.status = 400; e.code = "MISSING_FIELD"; throw e; }
  }
}
module.exports = { requireFields };
