import db from "../utils/db";
import { v4 as uuid } from "uuid";
import redis from "../utils/redis";
import sha1 from "sha1";

export default class AuthController {
  static async getConnect(req, res) {
    const auth_header = req.header("Authorization");
    if (!auth) {
      res.status(401).json({
        error: "Unauthorized",
      });
      return;
    }
    const sanitizeToken = auth_header.split(" ")[1];
    const decoded = Buffer.from(sanitizeToken, "base64").toString("utf-8");
    const [email, password] = decoded.split(":");

    if (!email || !password) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const collection = db.db.collection("users");
    const user = collection.findOne({ email: email });

    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const checkpassword = sha1(password);
    if (user.password !== checkpassword) {
      res.status(401).json({
        error: "Unauthorized",
      });
      return;
    }

    const token = uuid();
    const key = `auth_${token}`;
    redis.set(key, user._id, 24 * 60 * 60);

    res.status(200).json({
      token,
    });
  }

  static async getDisconnect(req, res) {
    let token = req.header("X-Token");
    if (!token) {
      res.status(401).json({
        error: "Unauthorized",
      });
      return;
    }
    const key = `auth_${token}`;
    const id = await redis.get(key);
    if (id) {
      await redisClient.del(key);
      res.status(204).send();
    } else {
      res.status(401).json({
        error: "Unauthorized",
      });
    }
  }
}
