const MongoClient = require('mongodb/lib/mongo_client')

class DbClient {
    constructor(){
        let port = process.env.DB_PORT;
        let host = process.env.DB_HOST;
        let db = process.env.DB_DATABASE;
        let url = `mongodb://${host}/${port}`;
        new MongoClient(url).connect().then(
            (client)=>{
                this.client = client;
                this.db = client.db(db);
            }).catch(err=>console.log(err));
    }

    isAlive(){
        return this.db ? true: false;
    }

    async nbUsers(){
        const collection = this.db.collection('users');
        return collection.countDocuments();
    }

    async nbFiles(){
        const collection = this.db.collection('files');
        return collection.countDocuments();
    }
}

const dbClient = new DbClient();

module.exports = dbClient
