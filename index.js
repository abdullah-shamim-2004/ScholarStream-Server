const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
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
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const db = client.db("scholar_stream_db");
    const userCollection = db.collection("users");
    const scholarCollection = db.collection("scholarships");

    // User related API
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        user.role = "student";
        user.createdAt = new Date();
        const email = user.email;

        // Check user exist
        const userExist = await userCollection.findOne({ email });

        if (userExist) {
          return res.status(409).send({
            success: false,
            message: "User already exists",
          });
        }
        // Insert user
        const result = await userCollection.insertOne(user);
        res.status(201).send({
          success: true,
          message: "User created successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });
    // scholarships releted api
    app.post("/scholarships", async (req, res) => {
      try {
        const scholarship = req.body;
        const result = await scholarCollection.insertOne(scholarship);
        res.status(201).send({
          success: true,
          message: "User created successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });
    app.get("/scholarships", async (req, res) => {
      try {
        const { limit, sort, search, email } = req.query;
        let query = {};
        if (email) {
          query = { email: email };
        }
        if (search) {
          query.scholarshipName = { $regex: search, $options: "i" };
        }
        let cursor = scholarCollection.find(query);
        if (limit) {
          cursor = cursor.limit(parseInt(limit));
        }
        if (sort === "top") {
          cursor = cursor.sort({ rating: -1 });
        }
        const result = await cursor.toArray();
        res.status(201).json(result);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });
    app.get("/scholarships/:id", async (req, res) => {
      const id = req.params.id;
      const result = await scholarCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });
    app.delete("/scholarships/:id", async (req, res) => {
      try {
        const id = req.params.id;
        if (!id) {
          return res.status(204).send({
            success: false,
            message: "Don't find id ",
          });
        }
        const result = await scholarCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.status(200).send({
          success: true,
          message: result,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });
    app.put("/scholarships/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;

        const updateDoc = {
          $set: updatedData,
        };

        const result = await scholarCollection.updateOne(
          { _id: new ObjectId(id) },
          updateDoc
        );

        res.send({
          success: true,
          message: "Scholarship updated successfully",
          result,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("Scholar stream server");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
