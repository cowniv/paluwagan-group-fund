import jwt from "jsonwebtoken";

export function signToken(user, secret) {
  return jwt.sign({ sub: user.id, name: user.name }, secret, { expiresIn: "7d" });
}

export function requireAuth(secret) {
  return (req, res, next) => {
    const header = req.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Login required" });
    try {
      const payload = jwt.verify(token, secret);
      req.userId = Number(payload.sub);
      next();
    } catch {
      res.status(401).json({ error: "Session expired, please log in again" });
    }
  };
}
