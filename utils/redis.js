const {createClient} = require('redis')

class RedisClient {
    constructor(){
        this.client = createClient()
        this.client.on('error', (err) => {
            console.log(err);
        })
    }

    isAlive(){
        return this.client.connected;
    }

    async get(key){
        return new Promise((resolve, reject)=>{
            this.client.get(key, (err, reply)=>{
                if(err)
                {
                    reject(err);
                }
                else
                {
                    resolve(reply);
                }
            })
        })
    }

    async set(key, value, duration){
        return new Promise((resolve, reject)=>{
            setTimeout(()=>{
            this.client.set(key, value, (err, reply)=>{
                if(err){
                    reject(err);
                }
                else
                {
                    resolve(reply)
                }
            })
        }, duration * 1000);
        })
    }

    async del(key){
        return new Promise((resolve, reject)=>{
            this.client.del(key, (err, reply)=>{
                if(err)
                {
                    reject(err);
                }
                else
                {
                    resolve(reply)
                }
            })
        })
    }
}


const redisClient = new RedisClient();

module.exports = redisClient;