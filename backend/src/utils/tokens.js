"use strict";
const crypto = require("node:crypto");
const token = () => crypto.randomBytes(32).toString("hex");
const refCode = (prefix) => prefix + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  return salt + ":" + crypto.scryptSync(String(pw), salt, 64).toString("hex");
}
function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const calc = crypto.scryptSync(String(pw), salt, 64);
  return crypto.timingSafeEqual(calc, Buffer.from(hash, "hex"));
}
module.exports = { token, refCode, hashPassword, verifyPassword };
