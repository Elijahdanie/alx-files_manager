import db from "../utils/db";
import redis from "../utils/redis";

export default class AppController {
  static getStatus(req, res) {
    return res.status(200).json({
      users: db.nbUsers(),
      files: db.nbFiles(),
    });
  }

  static getStats(req, res) {
    res.status(200).json({
      db: db.isAlive(),
      redis: redis.isAlive(),
    });
  }
}
