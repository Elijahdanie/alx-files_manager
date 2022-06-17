
import {createClient} from 'redis';
import {promisify} from 'util';

class RedisClient {
  constructor() {
    this.client = createClient();
    this.client.on('error', (err) => {
      console.log(err.message);
    });
  }

  isAlive() {
    return this.client.connected;
  }

  async get(key) {
    return promisify(this.client.get).bind(this.client)(key);
  }

  async set(key, value, duration) {
    const pset = promisify(this.client.set).bind(this.client);
    return pset(key, value, 'EX', duration);
  }

  async del(key) {
    const pdel = promisify(this.client.del).bind(this.client);
    return pdel(key);
  }
}

const redisClient = new RedisClient();

export default redisClient;
