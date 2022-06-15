import db from "../utils/db";
import redis from "../utils/redis";

export default class AppController {
  static async getStats(req, res) {
    return res.status(200).json({
      users: await db.nbUsers(),
      files: await db.nbFiles(),
    });
  }

  static getStatus(req, res) {
    res.status(200).json({
      db: db.isAlive(),
      redis: redis.isAlive(),
    });
  }
}
