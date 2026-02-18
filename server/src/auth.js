import jwt from "jsonwebtoken";

export function signToken(user, secret) {
  return jwt.sign({ sub: user.id, name: user.name }, secret, { expiresIn: "7d" });
}

export function requireAuth(secret) {
  return (req, res, next) => {
