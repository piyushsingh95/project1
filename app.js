const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

const app = express();
const port = process.env.PORT || 3001;

app.use(bodyParser.json());

const s3Client = new S3Client({
    region: "ap-south-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });   
// Initialize Firebase Admin SDK with your service account credentials
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Initialize MongoDB connection
const Uri = 'mongodb://dev:fbfPX4LEtlosgPAF@cluster0.8dhfuev.mongodb.net/';
//const mongoUri = 'mongodb+srv://dev:fbfPX4LEtlosgPAF@cluster0.8dhfuev.mongodb.net/';
const dbName = 'cardsdb';
const collectionName = 'cards';
//const mongoClient = new MongoClient(mongoUri);
const mongoClient = new MongoClient(Uri, {
  useNewUrlParser: true,
    useUnifiedTopology: true
});
async function connectToMongoDB() {
  try {
    await mongoClient.connect();
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
}
connectToMongoDB();

// Middleware for verifying Firebase access token
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

// Apply the verifyFirebaseToken middleware to specific routes
app.use(['/login-signin', '/verify-token', '/create-certificate', '/create-badge', '/fetch-certificate-badge'], verifyFirebaseToken);

// API endpoint for verifying the access token
app.post('/verify-token', (req, res) => {
  try {
    // If the request reaches here, the access token has been verified
    res.status(200).json({ success: true, message: 'Access token is valid' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/login-signin', async (req, res) => {
    try {
      const accessToken = req.body.accessToken;
  
      // Verify the Firebase access token
      const decodedToken = await admin.auth().verifyIdToken(accessToken);
  
      // Extract the UID from the decoded token
      const uid = decodedToken.uid;
  
      // Check if the UID exists in MongoDB
      const user = await mongoClient.db(dbName).collection(collectionName).findOne({ uid });
  
      if (user) {
        // If the user exists, send a success message
        res.status(200).json({ success: true, message: 'Access token is valid' });
      } else {
        // If the user doesn't exist, you can create a new user here
        // For example, you can insert a new user document into MongoDB
        // and then send a success message
        const newUser = { uid, /* other user data */ };
        await mongoClient.db(dbName).collection(collectionName).insertOne(newUser);
        res.status(200).json({ success: true, message: 'User created and access token is valid' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  

app.post('/create-certificate', (req, res) => {
  try {
    res.status(200).json({ success: true, message: 'Certificate created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API endpoint for creating badges
app.post('/create-badge', (req, res) => {
  try {
    res.status(200).json({ success: true, message: 'Badge created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/fetch-certificate-badge', (req, res) => {
  try {
    const data = {
      id: req.user.uid, // Assuming the middleware attached the user to the request
      name: 'Certificate 1',
      metadata: 'Certificate metadata',
    };
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

async function generatePresignedUrl(bucket, fileName, expiresInSeconds) {
    // Create the GetObject command
    const getObjectCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: fileName,
    });
  
    try {
      // Generate the signed URL
      const signedUrl = await getSignedUrl(s3Client, getObjectCommand, { expiresIn: expiresInSeconds });
      return signedUrl;
    } catch (error) {
      console.error("Error generating pre-signed URL:", error);
      throw error;
    }
  }
  
  // API endpoint for generating pre-signed URL for client-side file upload
  app.post('/generate-presigned-url', async (req, res) => {
    try {
      const { bucket, fileName, expiresInSeconds } = req.body;
      const presignedUrl = await generatePresignedUrl(bucket, fileName, expiresInSeconds);
      res.status(200).json({ success: true, presignedUrl });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

process.on('SIGINT', () => {
    mongoClient.close().then(() => {
      console.log('MongoDB connection closed.');
      process.exit(0);
    });
  });

app.get('/home', (req, res) => {
    res.status(200).json({ message: 'Code is working' });
  });
// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
