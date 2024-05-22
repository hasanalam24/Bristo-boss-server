const express = require('express')
const app = express()
const cors = require('cors');
const jwt = require('jsonwebtoken')
require('dotenv').config()
const port = process.env.PORT || 5000


//middlewares
app.use(cors())
app.use(express.json())


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qvnsypp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const usersCollections = client.db("BistroDB").collection("users");
        const menuCollections = client.db("BistroDB").collection("menu");
        const reviewsCollections = client.db("BistroDB").collection("reviews");
        const cartCollections = client.db("BistroDB").collection("carts");


        //jwt token
        app.post('/jwt', async (req, res) => {

            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })

        //middlewares
        const veryfyToken = (req, res, next) => {
            console.log('inside verify token', req.headers)
            next()
        }


        //user related api
        app.get('/users', veryfyToken, async (req, res) => {
            // console.log(req.headers) //client side er alluser theke headers use kore token ekhane get kora hocche
            const result = await usersCollections.find().toArray()
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const user = req.body;

            //insert email if user doesn't exists
            //you can do this many ways : (1. email unique, 2. upsert, 3.simple checking)

            const query = { email: user.email }
            const existUser = await usersCollections.findOne(query)
            if (existUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await usersCollections.insertOne(user)
            res.send(result)
        })

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await usersCollections.deleteOne(query)
            res.send(result)
        })

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollections.updateOne(filter, updatedDoc)
            res.send(result)
        })
        //user related api end



        //menu related apis
        app.get('/menu', async (req, res) => {
            const result = await menuCollections.find().toArray()
            res.send(result)
        })

        app.get('/reviews', async (req, res) => {
            const result = await reviewsCollections.find().toArray()
            res.send(result)
        })

        //cart collections
        app.get('/carts', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const result = await cartCollections.find(query).toArray()
            res.send(result)
        })

        app.post('/carts', async (req, res) => {
            const cartItem = req.body;
            const result = await cartCollections.insertOne(cartItem)
            res.send(result)
        })

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await cartCollections.deleteOne(query)
            res.send(result)
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('boss is sitting')

})

app.listen(port, () => {
    console.log(`Bistro boss is on port ${port}`)
})


/**
 * ----------------
 * NAMING CONVENTIONS
 * 
 * app.get('/users')
 * app.get('/users/:id')
 * app.post('/users')
 * app.put('/users/:id')
 * app.patch('/users/:id')
 * app.delete('/users/:id')
 * 
 * 
 */