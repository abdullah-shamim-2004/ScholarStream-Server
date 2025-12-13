const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;

// firebase admin
const admin = require("firebase-admin");

// index.js
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf8"
);
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Middleware
app.use(express.json());
app.use(cors());
// Firebase Middleware
const verifyFirebaseToken = async (req, res, next) => {
  const headerAuth = req.headers.authorization;
  if (!headerAuth) {
    return res.status(401).send({
      message: "Unothorized access",
    });
  }
  const token = headerAuth.split(" ")[1];
  if (!token) {
    return res.status(403).send("Unothorized access , There are no token.");
  }
  try {
    const verify = await admin.auth().verifyIdToken(token);
    req.token_email = verify.email;
    next();
  } catch (error) {
    return res.status(401).send({ message: error });
  }
};

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
    const paymentCollection = db.collection("payments");
    const applicationCollection = db.collection("applications");
    const reviewCollection = db.collection("reviews");

    // Middle ware with database access
    // Admin verification
    const verifyAdmin = async (req, res, next) => {
      try {
        const email = req.token_email;

        if (!email) {
          return res.status(401).json({
            success: false,
            message: "Unauthorized. Token email missing.",
          });
        }

        const user = await userCollection.findOne({ email });

        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found.",
          });
        }

        if (user.role !== "admin") {
          return res.status(403).json({
            success: false,
            message: "Forbidden access. Admin only route.",
          });
        }
        next();
      } catch (error) {
        console.error("verifyAdmin error:", error);
        res.status(500).json({
          success: false,
          message: "Internal server error.",
        });
      }
    };

    // Moderator verifiacation
    const verifyModerator = async (req, res, next) => {
      try {
        const email = req.token_email;

        if (!email) {
          return res.status(401).json({
            success: false,
            message: "Unauthorized. Token email missing.",
          });
        }

        const user = await userCollection.findOne({ email });

        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found.",
          });
        }

        if (user.role !== "moderator") {
          return res.status(403).json({
            success: false,
            message: "Forbidden access. Moderator only route.",
          });
        }

        next();
      } catch (error) {
        console.error("verifyModerator error:", error);
        res.status(500).json({
          success: false,
          message: "Internal server error.",
        });
      }
    };

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
    app.get("/users", async (req, res) => {
      try {
        const result = await userCollection.find().toArray();
        res.status(201).json(result);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });
    app.patch("/users/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { role } = req.body;
        if (!role) {
          return res.status(400).json({
            success: false,
            message: "Role is required",
          });
        }

        const updateDoc = {
          $set: {
            role,
          },
        };
        const result = await userCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          updateDoc
        );
        res.status(200).json({
          success: true,
          message: "Review updated successfully",
          result,
        });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });
    app.get("/users/:email/role", async (req, res) => {
      try {
        const email = req.params.email;
        if (!email) {
          return res.status(404).send({ message: "No email found !" });
        }
        const user = await userCollection.findOne({ email });
        res.status(200).send({ role: user?.role || "student" });
      } catch (error) {
        res.send({ message: error });
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
        let {
          limit = 8,
          sort,
          search = "",
          email,
          subject = "",
          country = "",
          degree = "",
          page = 1,
        } = req.query;

        limit = parseInt(limit);
        page = parseInt(page);

        let query = {};

        if (email) query.email = email;
        if (subject) query.subjectCategory = subject;
        if (country) query.country = country;
        if (degree) query.degree = degree;

        if (search.trim()) {
          query.$or = [
            { scholarshipName: { $regex: search, $options: "i" } },
            { universityName: { $regex: search, $options: "i" } },
            { degree: { $regex: search, $options: "i" } },
          ];
        }

        // total page
        const total = await scholarCollection.countDocuments(query);

        let cursor = scholarCollection.find(query);

        // sorting
        if (sort === "top") {
          cursor = cursor.sort({ applicationFees: 1 });
        }

        //  pagination 
        const skip = (page - 1) * limit;
        cursor = cursor.skip(skip).limit(limit);

        const scholarships = await cursor.toArray();

        res.status(200).json({
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          scholarships,
        });
      } catch (error) {
        console.error("Scholarships API Error:", error);
        res.status(500).json({
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

    // payment api
    app.post("/create-checkout-session", async (req, res) => {
      try {
        const {
          amount,
          scholarshipName,
          universityName,
          scholarshipId,
          studentEmail,
          applicationId,
        } = req.body;

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],

          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: { name: scholarshipName },
                unit_amount: amount * 100,
              },
              quantity: 1,
            },
          ],

          mode: "payment",
          customer_email: studentEmail,

          metadata: {
            scholarshipId,
            applicationId,
            scholarshipName,
            universityName,
          },

          success_url: `${process.env.VITE_CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.VITE_CLIENT_URL}/payment-failed`,
        });

        res.send({ url: session.url });
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Stripe session error" });
      }
    });
    // If payment is succesfull , then store the data
    app.get("/payment-verify", async (req, res) => {
      try {
        const sessionId = req.query.session_id;
        // validate session id
        if (!sessionId) {
          return res
            .status(400)
            .json({ success: false, message: "Session ID missing" });
        }

        // Fetch Stripe sessiona)
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ["line_items.data.price.product"],
        });
        console.log("SESSION FULL:", session);

        // validate session
        if (!session) {
          return res.status(404).json({
            success: false,
            message: "Invalid session",
          });
        }
        // validate payment
        if (session.payment_status !== "paid") {
          return res.status(400).json({
            success: false,
            paymentStatus: "unpaid",
            message: "Payment not completed.",
          });
        }
        if (!session.metadata?.scholarshipId) {
          return res.status(400).json({
            success: false,
            message: "Missing Scolarship MetaData",
          });
        }

        // find transactionId
        const transactionId = session.payment_intent;
        // validate transaction id
        if (!transactionId) {
          return res.status(400).json({
            success: false,
            message: "Missing transactionId",
          });
        }
        // Check duplicate payment
        const paymentExist = await applicationCollection.findOne({
          transactionId,
        });
        if (paymentExist) {
          return res.status(409).json({
            success: false,
            message: "Payment already processed",
            existedPayment: paymentExist,
          });
        }

        // Extract metadata
        const scholarshipId = session.metadata.scholarshipId;
        const applicationId = session.metadata.applicationId;
        const scholarshipName = session.metadata.scholarshipName;
        const universityName = session.metadata.universityName;
        if (applicationId) {
          const applicationExist = await applicationCollection.findOne({
            _id: new ObjectId(applicationId),
          });
          if (applicationExist) {
            const updateDoc = {
              $set: { paymentStatus: "paid", transactionId: transactionId },
            };
            const result = await applicationCollection.updateOne(
              { _id: new ObjectId(applicationId) },
              updateDoc
            );
            res.send({
              success: true,
              message: "Application updated successfully",
              result,
            });
            return;
          }
        }

        // Prepare application object
        const isPaid = session.payment_status === "paid";
        const applicationData = {
          // userId,
          userEmail: session.customer_details?.email || session.customer_email,
          scholarshipId,
          scholarshipName,
          universityName,
          transactionId,
          amount: session.amount_total / 100,
          currency: session.currency || "USD",
          paymentStatus: isPaid ? "paid" : "unpaid",
          ApplicationStatus: "pending",
          appliedAt: new Date(),
          paidAt: new Date(),
        };
        // Insert into applications collection
        if (!applicationId) {
          const insertApplication = await applicationCollection.insertOne(
            applicationData
          );
          return res.status(200).json({
            success: true,
            message: "Payment verified & application saved",
            applicationId: insertApplication.insertedId,
          });
        }

        // Insert into payment history collection
        // const paymentHistory = {
        //   ...applicationData,
        //   createdAt: new Date(),
        // };
        // const paymentResult = await paymentCollection.insertOne(paymentHistory);
      } catch (error) {
        console.log("Payment verify error:", error);
        res.status(500).json({
          message: "Failed to verify payment",
          error: error.message,
        });
      }
    });
    // If payment is failed then store the data as pending
    app.post("/payment-failed-record", async (req, res) => {
      try {
        const {
          scholarshipId,
          scholarshipName,
          universityName,
          userEmail,
          amount,
        } = req.body;

        //  Prevent duplicate application

        const applicationExist = await applicationCollection.findOne({
          scholarshipId,
          userEmail,
        });

        if (applicationExist) {
          return res.status(409).json({
            success: false,
            message: "Application already exists for this user",
            existedApplication: applicationExist,
          });
        }

        //  Create unpaid application entry

        const applicationData = {
          userEmail,
          scholarshipId,
          scholarshipName,
          universityName,
          amount,
          paymentStatus: "unpaid",
          ApplicationStatus: "pending",
          appliedAt: new Date(),
        };

        const result = await applicationCollection.insertOne(applicationData);

        return res.status(201).json({
          success: true,
          message: "Unpaid application saved successfully",
          applicationId: result.insertedId,
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    });
    // My application api
    app.get("/my-applications", async (req, res) => {
      try {
        const { userEmail } = req.query;
        if (!userEmail) {
          return res.status(404).json({
            success: false,
            message: "Email not found!",
          });
        }
        const result = await applicationCollection
          .find({ userEmail })
          .toArray();
        res.status(201).json({
          success: true,
          applications: result,
        });
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
    });
    app.delete("/my-applications/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await applicationCollection.deleteOne({
          _id: new ObjectId(id),
        });
        return res.status(201).json({
          success: true,
          result,
        });
      } catch (error) {
        return res.status(4501).json({ error: error.message });
      }
    });
    // Review releted api
    app.post("/my-reviews", async (req, res) => {
      try {
        const {
          scholarshipId,
          scholarshipName,
          universityName,
          userName,
          userEmail,
          userImage,
          rating,
          comment,
        } = req.body;

        const reviewData = {
          scholarshipId,
          scholarshipName,
          universityName,
          userName,
          userEmail,
          userImage: userImage || null,
          rating: Number(rating),
          comment,
          reviewDate: new Date(),
        };

        const result = await reviewCollection.insertOne(reviewData);

        res.status(201).json({
          success: true,
          message: "Review added successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.log("Review error:", error);
        res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    });
    app.get("/my-reviews", async (req, res) => {
      try {
        const userEmail = req.query.userEmail;

        if (!userEmail) {
          return res.status(400).json({
            success: false,
            message: "User email missing",
          });
        }

        const reviews = await reviewCollection
          .find({ userEmail })
          .sort({ reviewDate: -1 })
          .toArray();

        res.status(200).json({
          success: true,
          reviews,
        });
      } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: error.message });
      }
    });
    app.patch("/my-reviews/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { rating, comment } = req.body;

        const updateDoc = {
          $set: {
            rating: Number(rating),
            comment,
            reviewDate: new Date(),
          },
        };

        const result = await reviewCollection.updateOne(
          { _id: new ObjectId(id) },
          updateDoc
        );

        res.status(200).json({
          success: true,
          message: "Review updated successfully",
          result,
        });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });
    app.delete("/my-reviews/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const result = await reviewCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.status(200).json({
          success: true,
          message: "Review deleted successfully",
          result,
        });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });
    // all application api
    app.get("/all-applications", async (req, res) => {
      try {
        const result = await applicationCollection.find().toArray();
        res.send({ success: true, applications: result });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });
    // update application status
    app.patch("/all-applications/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { status, feedback } = req.body;
        const updateField = {};
        if (status) updateField.ApplicationStatus = status;
        if (feedback) {
          updateField.feedback = feedback;
        }

        const result = await applicationCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateField }
        );
        res.send({ success: true, result });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
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
