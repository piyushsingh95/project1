const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');

const app = express();
const port = process.env.PORT || 3001;
 
app.use(bodyParser.json());

const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// ... Other imports and setup code ...

const mongoUri = 'mongodb+srv://dev:fbfPX4LEtlosgPAF@cluster0.8dhfuev.mongodb.net/';
const dbName = 'cardsdb';
const collectionName = 'cards';

const mongoClient = new MongoClient(mongoUri);

async function connectToMongoDB() {
  try {
    await mongoClient.connect();
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
}

connectToMongoDB();



const verifyFirebaseToken = async (req, res, next) => {
  const { accessToken } = req.body;

  if (!accessToken) {
    console.error("No access token found in the request.");
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await admin.auth().verifyIdToken(accessToken);
    next();
  } catch (error) {
    console.error("Error verifying token:", error);
    return res.status(401).json({ error: "Unauthorized" });
  }
};

app.use(['/login-signin'], verifyFirebaseToken);

app.post('/login-signin', async (req, res) => {
  try {
    const accessToken = req.body.accessToken;

    const decodedToken = await admin.auth().verifyIdToken(accessToken);
    const uid = decodedToken.uid;

    const user = await mongoClient.db(dbName).collection(collectionName).findOne({ uid });

    if (user) {
      res.status(200).json({ success: true, message: 'Access token is valid' });
    } else {
      const newUser = { uid /* other user data */ };
      await mongoClient.db(dbName).collection(collectionName).insertOne(newUser);
      res.status(200).json({ success: true, message: 'User created and access token is valid' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.status(200).json({ message: 'Code is working' });
});

process.on('SIGINT', () => {
  mongoClient.close().then(() => {
    console.log('MongoDB connection closed.');
    process.exit(0);
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
