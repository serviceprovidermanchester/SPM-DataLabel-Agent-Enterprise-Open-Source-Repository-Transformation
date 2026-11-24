"use strict";
const { fail } = require("../utils/respond");
function handleError(res, err) {
  if (err && err.status) return fail(res, err.status, err.code || "ERROR", err.message);
  if (err && /UNIQUE constraint/.test(String(err.message))) return fail(res, 409, "DUPLICATE", "That record already exists");
  console.error(err);
  return fail(res, 500, "INTERNAL", "Something went wrong on the server");
}
module.exports = { handleError };
