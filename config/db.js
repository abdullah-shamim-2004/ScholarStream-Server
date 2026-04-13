// Database configaration
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// Mongodb URL
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ixbmwio.mongodb.net/?appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Connect with database
let db;
const connectDB = async () => {
  await client.connect;
  db = client.db("scholar_stream_db");
  console.log("Mongodb Connected");
};
const getCollection = (name) => db.collection(name);
// exporting
module.exports = {
  connectDB,
  getCollection,
};
