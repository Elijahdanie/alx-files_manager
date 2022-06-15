import { Router } from 'express';
import AppController from '../controllers/AppController';
import UserController from '../controllers/UserController';

const router = new Router();

router.get('/status', AppController.getStatus);
router.get('/stats', AppController.getStats);

router.post('/users', UserController.postNew);
