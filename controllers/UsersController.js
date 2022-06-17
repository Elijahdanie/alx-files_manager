import sha1 from 'sha1'
import { ObjectId } from "mongodb";
import dbClient from "../utils/db";
import redisClient from "../utils/redis";

/**
 * @class UsersController
 * @description This class handles all authorization related requests
 */
class UsersController {
  /**
   * @param {object} req
   * @param {object} res
   * @returns {object} user
   * @memberof UsersController
   * @description This method creates a new user
   */
  static async postNew(req, res) {
    const { email, password } = req.body;
    if (!email) {
      res.status(400).send({
        error: "Missing email",
      });
      return;
    }
    if (!password) {
      res.status(400).send({
        error: "Missing password",
      });
      return;
    }
    const users = dbClient.db.collection("users");

    const user = await users.findOne({
      email,
    });
    if (user) {
      res.status(400).send({
        error: "Already exist",
      });
      return;
    }

    const hash = sha1(password);
    const newUser = await users.insertOne({
      email,
      password: hash,
    });
    const json = {
      id: newUser.insertedId,
      email,
    };
    res.status(201).send(json);
  }

  /**
   * @param {object} req
   * @param {object} res
   * @returns {object} user
   * @description This method returns the current user
   */
  static async getMe(req, res) {
    const tokendata = req.header("X-Token") || null;
    if (!tokendata) {
      res.status(401).send({
        error: "Unauthorized",
      });
      return;
    }
    const key = `auth_${tokendata}`;
    const id = await redisClient.get(key);
    if (!user) {
      res.status(401).send({
        error: "Unauthorized",
      });
      return;
    }
    const users = dbClient.db.collection("users");
    const user = await users.findOne({
      _id: ObjectId(id),
    });
    if (user) {
      res.status(200).send({
        id: id,
        email: user.email,
      });
    } else {
      res.status(401).send({
        error: "Unauthorized",
      });
    }
  }
}

export default UsersController;
