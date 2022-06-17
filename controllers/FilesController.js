import {
  ObjectId,
} from 'mongodb';
import {
  env,
} from 'process';
import {
  v4 as uuidv4,
} from 'uuid';
import path from 'path';
import mime from 'mime-types';
import fs from 'fs';
import Queue from 'bull';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';
import { promisify } from 'util';

const fileQueue = new Queue('fileQueue', {
  redis: {
    host: '127.0.0.1',
    port: 6379,
  },
});

/**
 * @class FilesController
 * @description Controller for files related operations
 * @exports FilesController
 */
class FilesController {
  /**
   * @method postUpload
   * @description Uploads a file
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} - Express response object
   */
  static async postUpload(req, res) {
    const user = await this.getCurrentUser(req);
    if (!user) {
      res.status(401).send({
        error: 'Unauthorized',
      });
      return;
    }
    const {
      name,
      type,
      parentId,
      isPublic,
      data,
    } = req.body;

    if (!name) {
      res.status(400).send({
        error: 'Missing name',
      });
      return;
    }

    if ((!type || !['folder', 'file', 'image'].includes(type))) {
      res.status(400).send({
        error: 'Missing type',
      });
      return;
    }

    if (!data && type !== 'folder') {
      res.status(400).send({
        error: 'Missing data',
      });
      return;
    }

    if (parentId) {
      const files = dbClient.db.collection('files');
      const parent = await files.findOne({
        _id: ObjectId(parentId),
      });
      if (!parent) {
        res.status(400).send({
          error: 'Parent not found',
        });
        return;
      }
      if (parent.type !== 'folder') {
        res.status(400).send({
          error: 'Parent is not a folder',
        });
        return;
      }
    }

    const newFile = {
      name,
      type,
      parentId: parentId ? parentId : 0,
      isPublic: isPublic ? isPublic : false,
      userId: user._id.toString(),
    };
    if (type === 'folder') {
      const files = dbClient.db.collection('files');
      const result = await files.insertOne(newFile);
      newFile =  { id:result.insertedId, ...newFile};
      delete newFile._id;
      res.setHeader('Content-Type', 'application/json');
      res.status(201).send(newFile);
    } else {
      const storeFolderPath = env.FOLDER_PATH || '/tmp/files_manager';
      const fileName = uuidv4();
      const filePath = path.join(storeFolderPath, fileName);

      newFile.localPath = filePath;
      const decodedData = Buffer.from(data, 'base64');

      const pathExists = await FilesController.pathExists(storeFolderPath);
      if (!pathExists) {
        await fs.promises.mkdir(storeFolderPath, { recursive: true });
      }
      FilesController.writeToFile(res, filePath, decodedData, newFile);
    }
  }

  /**
   * @method writeToFile
   * @description Helper function of @postUpload that writes the file to the disk
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} - Express response object
   */
  static async writeToFile(res, filePath, data, newFile) {
    // write to file
    await fs.promises.writeFile(filePath, data, 'utf-8');

    const files = dbClient.db.collection('files');
    const result = await files.insertOne(newFile);
    const writeResp = {
      ...newFile,
      id: result.insertedId,
    };
    delete writeResp._id;
    delete writeResp.localPath;

    // add to queue to process file thumbnails
    if (writeResp.type === 'image') {
      fileQueue.add({ userId: writeResp.userId, fileId: writeResp.id });
    }

    res.setHeader('Content-Type', 'application/json');
    res.status(201).send(writeResp);
  }

  /**
   * @method getCurrentUser
   * @description retrieve user based on auth token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} - Express response object
   */
  static async getCurrentUser(req) {
    const tokenData = req.header('X-Token') || null;
    if (!tokenData) return null;
    const key = `auth_${tokenData}`;
    const id = await redisClient.get(key);
    if (!id) return null;
    const users = dbClient.db.collection('users');
    const user = await users.findOne({
      _id: ObjectId(id),
    });
    if (!user) return null;
    return user;
  }

  /**
   * @method getShow
   * @description retrieve files based on id
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} - Express response object
   */
  static async getShow(req, res) {
    const {
      id,
    } = req.params;
    const user = await this.getCurrentUser(req);
    if (!user) {
      res.status(401).send({
        error: 'Unauthorized',
      });
      return;
    }

    const files = dbClient.db.collection('files');
    const file = await files.findOne({
      _id: ObjectId(id),
      userId: user._id,
    });
    if (!file) {
      res.status(404).send({
        error: 'Not found',
      });
    } else {
      file.id = file._id;
      delete file._id;
      delete file.localPath;
      res.status(200).send(file);
    }
  }

  /**
   * @method getIndex
   * @description retrieve files based on parentid and pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} - Express response object
   */
  static async getIndex(req, res) {
    const user = await FilesController.getCurrentUser(req);
    if (!user) {
      res.status(401).send({
        error: 'Unauthorized',
      });
      return;
    }
    const {
      parentId,
      page,
    } = req.query;
    const files = dbClient.db.collection('files');

    // Perform pagination
    const pageSize = 20;
    const pageNumber = page || 1;
    const skip = (pageNumber - 1) * pageSize;

    // if parentId is not provided retrieve all files
    let query;
    if (!parentId) {
      query = {
        userId: user._id.toString(),
      };
    } else {
      query = {
        userId: user._id.toString(),
        parentId,
      };
    }

    // handle pagination using aggregation
    const result = await files.aggregate([
      {
        $match: query,
      },
      {
        $skip: skip,
      },
      {
        $limit: pageSize,
      },
    ]).toArray();

    const finalResult = result.map((file) => {
      const newFile = {
        ...file,
        id: file._id,
      };
      delete newFile._id;
      delete newFile.localPath;
      return newFile;
    });
    res.status(200).send(finalResult);
  }

  /**
   * @method putPublish
   * @description set isPublic to true on the file document based on the ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} - Express response object
   */
  static putPublish(req, res) {
    FilesController.pubSubHelper(req, res, true);
  }

  /**
   * @method putUnpublish
   * @description set isPublic to false on the file document based on the ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} - Express response object
   */
  static putUnpublish(req, res) {
    FilesController.pubSubHelper(req, res, false);
  }

  /**
   * @method pubSubHelper
   * @description helper method for @putPublish and @putUnpublish
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Boolean} isPublic - isPublic value to set
   * @returns {Object} - Express response object
   */
  static async pubSubHelper(req, res, updateValue) {
    const {
      id,
    } = req.params;
    const user = await this.getCurrentUser(req);
    if (!user) {
      res.status(401).send({
        error: 'Unauthorized',
      });
      return;
    }
    const files = dbClient.db.collection('files');
    const file = await files.findOne({
      userId: user._id,
      _id: ObjectId(id),
    });
    if (!file) {
      res.status(404).send({
        error: 'Not found',
      });
    } else {
      const update = {
        $set: {
          isPublic: updateValue,
        },
      };
      await files.updateOne({
        _id: ObjectId(id),
      }, update);
      const updatedFile = await files.findOne({
        _id: ObjectId(id),
      });
      updatedFile.id = updatedFile._id;
      delete updatedFile._id;
      delete updatedFile.localPath;
      res.status(200).send(updatedFile);
    }
  }

  /**
   * @method getFile
   * @description return the content of the file document based on the ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} - Express response object
   */
  static async getFile(req, res) {
    const id = req.params.id;
    const size = req.query.size;
    if (!id) {
      res.status(404).send({
        error: 'Not found',
      });
      return;
    }
    const user = await this.getCurrentUser(req);
    const files = dbClient.db.collection('files');
    const file = await files.findOne({
      _id: ObjectId(id),
    });
    if (!file) {
      res.status(404).send({
        error: 'Not found',
      });
      return;
    }
    if (!user && file.isPublic === false) {
      res.status(404).send({
        error: 'Not found',
      });
      return;
    }
    if (file.isPublic === false && user && file.userId !== user._id.toString()) {
      res.status(404).send({
        error: 'Not found',
      });
      return;
    }
    if (file.type === 'folder') {
      res.status(400).send({
        error: 'A folder doesn\'t have content',
      });
      return;
    }

    const lookUpPath = size && file.type === 'image'
      ? `${file.localPath}_${size}`
      : file.localPath;

    const checkFile = promisify(fs.existsSync);
    // check if file exists
    if (!(await checkFile(lookUpPath))) {
      res.status(404).send({
        error: 'Not found',
      });
    } else {
      // read file with fs
      res.set('Content-Type', mime.lookup(file.name));
      res.status(200).sendFile(lookUpPath);
    }
  }

  /**
   * @method pathExists
   * @description check if the path exists
   * @param {String} path - path to check
   * @returns {Boolean} - true if path exists, false otherwise
   */
  static pathExists(path) {
    return new Promise((resolve) => {
      fs.access(path, fs.constants.F_OK, (err) => {
        resolve(!err);
      });
    });
  }
}

export default FilesController;
