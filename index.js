require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId, } = require('mongodb');
const app = express()


const admin = require("firebase-admin");
// Decode base64
const serviceAccountJSON = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8');
const serviceAccount = JSON.parse(serviceAccountJSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});




const port = process.env.PORT||3000
 app.use(cors())
 app.use(express.json())

// middleware
 const verifyJWT=async(req,res,next)=>{
  const authHeader=req.headers.authorization
   if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ message: 'Unauthorized - No token provided' });
  }
  const token =authHeader.split(' ')[1]
  try{
     const decodedUser = await admin.auth().verifyIdToken(token);
    req.user = decodedUser;
    next();
  }
  catch(error){
  res.status(403).send({ message: 'Forbidden - Invalid token', error: error.message });
  }
 }

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_KEY}@cluster0.0bhdbts.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    const categoriesCollection=client.db('brimmart-shop').collection('categories')
    const reSellersCollection=client.db('brimmart-shop').collection('resellers')
    
    const cartCollection=client.db('brimmart-shop').collection('cart')
    const partnersCollection=client.db('brimmart-shop').collection('partner')
    


    
  // get all products with optional sorting

  await reSellersCollection.updateMany(
      { minQty: { $type: 'string' } },
      [{ $set: { minQty: { $toInt: '$minQty' } } }]
    );

app.get('/allProducts', async (req, res) => {
  try {
    const sortBy = req.query.sortBy || 'minQty';
    const order = req.query.order === 'desc' ? -1 : 1;

    const sortOption = {};
    sortOption[sortBy] = order;

    const resellerProducts = await reSellersCollection.find({}).sort(sortOption).toArray();

    const allProducts = resellerProducts.map(p => ({ ...p, source: 'resellers' }));
    res.send(allProducts);

  } catch (error) {
    console.error('Error fetching all products:', error);
    res.status(500).send({ success: false, message: 'Failed to fetch all products' });
  }
});

    // get all api 
    app.get('/allProduct/available',async(req,res)=>{
      const query= {
         minQty : { $gt : 100}
      }
      const result= await reSellersCollection.find(query).toArray()
      res.send(result)

    })

    //  categoris related api 
    app.get('/products',async(req,res)=>{
        
    const query=req.query
        const result = await categoriesCollection.find(query).toArray() 
        res.send(result)

    })
    //  products  get by one 
    app.get('/products/:id', async (req, res) => {
      const id = req.params.id;
      const product = await categoriesCollection.findOne({ _id: new ObjectId(id) });
      res.send(product);
    });


 app.get('/categories', async (req, res) => {
  try {
    const products = await categoriesCollection.find({}).toArray();
     
    const categoryMap = new Map();

    products.forEach(product => {
      if (!categoryMap.has(product.category)) {
        categoryMap.set(product.category, {
          category: product.category,
          image: product.image, 
        });
      }
    });

    const categories = Array.from(categoryMap.values());
    res.send(categories);

  } catch (error) {
    res.status(500).send({ error: 'Failed to fetch categories' });
  }
});




    //  get data by category name 
    app.get('/products/category/:category', async (req, res) => {
  const category = req.params.category;
  const result = await categoriesCollection.find({ category }).toArray();
  res.send(result);
});

// buy data 
app.patch("/buy-product/:id", async (req, res) => {
  const id = req.params.id;
  const quantity = parseInt(req.body.quantity);
  if (!quantity || quantity <= 0) {
    return res.status(400).json({ error: "Invalid quantity" });
  }

  const filter = {
    _id: new ObjectId(id),
    available: { $gte: quantity },
  };

  const updateDoc = {
    $inc: {  available: -quantity },
  };
   try {
    const result = await categoriesCollection.updateOne(filter, updateDoc);
    if (result.modifiedCount > 0) {
      res.send({ success: true, message: "Purchase successful" });
    } else {
      res.status(400).send({ success: false, message: "Not enough quantity or product not found." });
    }
  } catch (error) {
    res.status(500).send({ error: "Server error", message: error.message });
  }
  
});

//  get resellers data
 app.get('/resellers',async(req,res)=>{
        
        const query=req.query
        const result = await reSellersCollection.find(query).toArray() 
        res.send(result)

    })
    //  get resellers data by email
     app.get('/resellers/:email', async (req, res) => {
  const email = req.params.email.toLowerCase();
  try {
    const result = await reSellersCollection.find({ email }).toArray();
    if (!result || result.length === 0) {
      return res.status(404).send({ error: "User not found" });
    }
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching reseller data', error: error.message });
  }
});
//  get reseller data by id 
app.get('/resellers/id/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const product = await reSellersCollection.findOne({ _id: new ObjectId(id) });
    if (!product) return res.status(404).send({ error: 'Product not found' });
    res.send(product); 
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});


      //patch the reseller data
     app.patch('/resellers/:id', async (req, res) => {
  const id = req.params.id;
  const updatedData = req.body;

  try {
    const result = await reSellersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData }
    );

    if (result.modifiedCount > 0) {
      res.send({ success: true, message: 'Reseller product updated' });
    } else {
      res.status(404).send({ success: false, message: 'Product not found or no changes made' });
    }
  } catch (error) {
    res.status(500).send({ success: false, message: 'Update failed', error: error.message });
  }
});


//  post reseller data 
app.post('/resellers', async (req, res) => {
  const resellerData = req.body;
  try {
    const resellersResult = await reSellersCollection.insertOne(resellerData);
    const categoryResult = await categoriesCollection.insertOne({
      ...resellerData,
      insertedId: resellersResult.insertedId,
      available: resellerData.available || 0,
    });

    res.send({ success: true, resellerId: resellersResult.insertedId, categoryId: categoryResult.insertedId });
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to add reseller', error: error.message });
  }
});


//  cart collection related api 

//  get cart data 
app.get('/cart', verifyJWT, async (req, res) => {
  
    const email = req.query.email;
  const decodedEmail = req.user.email;

  if (email !== decodedEmail) {
    return res.status(403).send({ message: 'Forbidden - Email mismatch' });
  }

    const result = await cartCollection.find({ userEmail: email }).toArray();
    res.send(result);
  
});


// post cart data 
app.post('/cart', async (req, res) => {
  const item = req.body;
  try {
    const result = await cartCollection.insertOne(item);
    res.send({ success: true, insertedId: result.insertedId });
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to add to cart', error: error.message });
  }
});

//  peatch the cart increment
app.patch('/cart/:id', verifyJWT, async (req, res) => {
  const cartId = req.params.id;
  const { newQuantity } = req.body;

  try {
    const cartItem = await cartCollection.findOne({ _id: new ObjectId(cartId) });
    if (!cartItem) return res.status(404).send({ message: "Cart item not found" });

    const productId = cartItem.productId;
    const oldQuantity = cartItem.buyingQuantity;
    const quantityDiff = newQuantity - oldQuantity;

   
    if (quantityDiff > 0) {
      const result = await categoriesCollection.updateOne(
        { _id: new ObjectId(productId), available: { $gte: quantityDiff } },
        { $inc: { available: -quantityDiff } }
      );
      if (result.modifiedCount === 0) {
        return res.status(400).send({ success: false, message: "Not enough stock" });
      }
    } else if (quantityDiff < 0) {
      await categoriesCollection.updateOne(
        { _id: new ObjectId(productId) },
        { $inc: { available: Math.abs(quantityDiff) } }
      );
    }

    await cartCollection.updateOne(
      { _id: new ObjectId(cartId) },
      { $set: { buyingQuantity: newQuantity } }
    );

    res.send({ success: true, message: "Cart updated and product quantity adjusted" });

  } catch (error) {
    res.status(500).send({ success: false, message: "Failed to update cart", error: error.message });
  }
});


// delete from cart 
app.delete('/cart/:id', verifyJWT, async (req, res) => {
  const cartId = req.params.id;

  try {
    const cartItem = await cartCollection.findOne({ _id: new ObjectId(cartId) });
    if (!cartItem) return res.status(404).send({ message: "Item not found" });

    const { productId, buyingQuantity } = cartItem;

    // Decrease main quantity using $inc
    await categoriesCollection.updateOne(
      { _id: new ObjectId(productId) },
     { $inc: { available: buyingQuantity } }

    );

    
    const result = await cartCollection.deleteOne({ _id: new ObjectId(cartId) });
    res.send({ success: true, message: 'Item removed from cart' });

  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to remove from cart', error: error.message });
  }
});

// partner related api 

app.get('/partners',async(req,res)=>{
        const result = await partnersCollection.find({}).toArray() 
        res.send(result)

    })




    
  } finally {
   
  }
}
run().catch(console.dir);


// express js 
 app.get('/', (req, res) => {
  res.send('Brimmart server is cooking ......')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})