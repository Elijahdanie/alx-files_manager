import db from "../utils/db";
import sha1 from "sha1";

export default class UsersController {
  static async postNew(req, res) {
    const { password, email } = req.body;
    if (!email) res.status(400).json({ error: "Missing email" });
    if (!password) res.status(400).json({ error: "Missing password" });
    const collection = db.db.collection("users");
    const user = collection.findOne({ email: email });
    if (!user) res.status(400).json({ error: "Already exist" });
    const hash = sha1(password);
    const result = await collection.insertOne({ email: email, password: hash });
    res.status(201).json({ email: email, id: result.insertedId });
  }
}
