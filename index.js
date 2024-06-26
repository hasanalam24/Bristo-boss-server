const express = require('express')
const app = express()
const cors = require('cors');
const jwt = require('jsonwebtoken')
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
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
        // await client.connect();

        const usersCollections = client.db("BistroDB").collection("users");
        const menuCollections = client.db("BistroDB").collection("menu");
        const reviewsCollections = client.db("BistroDB").collection("reviews");
        const cartCollections = client.db("BistroDB").collection("carts");
        const paymentCollections = client.db("BistroDB").collection("payments");


        //jwt token
        app.post('/jwt', async (req, res) => {

            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })

        //middlewares
        const verifyToken = (req, res, next) => {
            // console.log('inside verify token', req.headers.authorization)
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'forbidden access' })
            }
            const token = req.headers.authorization.split(' ')[1] //eta korar dhara Bearer lekha te bad diye shudhu token k nichhi

            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'forbidden access' })
                }
                req.decoded = decoded; //token er email ta ekhane ashbe
                next()
            })
        }

        //user admin kina ta check korar jonno eta
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollections.findOne(query)
            const isAdmin = user?.role === 'admin'
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next()
        }

        //user related api
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            // console.log(req.headers) //client side er alluser theke headers use kore token ekhane get kora hocche
            const result = await usersCollections.find().toArray()
            res.send(result)
        })

        //admin check 
        app.get('/users/admin/:email', verifyToken, verifyAdmin, async (req, res) => {
            const email = req.params.email
            //check admin
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email }
            const user = await usersCollections.findOne(query)
            let admin = false;
            if (user) {
                admin = user?.role === 'admin'
            }
            res.send({ admin })
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

        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
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

        app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
            const item = req.body;
            const result = await menuCollections.insertOne(item)
            res.send(result)
        })

        app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await menuCollections.deleteOne(query)
            res.send(result)
        })

        app.get('/menu/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await menuCollections.findOne(query)
            res.send(result)
        })

        app.patch('/menu/:id', async (req, res) => {
            const item = req.body
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }

            const updatedDoc = {
                $set: {
                    name: item.name,
                    category: item.category,
                    price: item.price,
                    recipe: item.recipe,
                    image: item.image,
                }
            }
            const result = await menuCollections.updateOne(filter, updatedDoc)
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

        //Payment Intent
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);

            console.log('inside the server amount:', amount)

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']

            })

            res.send({
                clientSecret: paymentIntent.client_secret
            })

        })

        app.get('/payments/:email', verifyToken, async (req, res) => {
            const email = req.params.email

            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { email: email }
            const result = await paymentCollections.find(query).toArray()
            res.send(result)
        })

        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const paymentResult = await paymentCollections.insertOne(payment)

            //carefully delete each item from the cart
            // console.log('payment info', payment)

            const query = { _id: { $in: payment.cartIds.map(id => new ObjectId(id)) } }

            const deleteResult = await cartCollections.deleteMany(query)

            res.send({ paymentResult, deleteResult })
        })

        //stats or analytics
        app.get('/admin-stats', async (req, res) => {
            const users = await usersCollections.estimatedDocumentCount()
            const menuItems = await menuCollections.estimatedDocumentCount()
            const orders = await paymentCollections.estimatedDocumentCount()

            //this is not best way
            // const payments = await paymentCollections.find().toArray()
            // const revenue = payments.reduce((total, payment) => total + payment.price, 0)

            //best way
            const result = await paymentCollections.aggregate([
                {
                    $group: {
                        _id: null,
                        totalRevenue: {
                            $sum: '$price'
                        }
                    }
                }
            ]).toArray()

            const revenue = result.length > 0 ? result[0].totalRevenue : 0

            res.send({ users, menuItems, orders, revenue })
        })

        /**
         * using categories awaise chart list
         * ----------------------
         * NON-Efficient Way
         * ----------
         * 1. load all the payments
         * 2. for every menuItems (which is an array), go find the item form menu collection
         * 3. for every item in the menu collection that you found from a payment entry(document)
         * 
         */

        //Efficient Way
        //Using aggregate pipeline
        app.get('/order-stats', async (req, res) => {
            const result = await paymentCollections
                .aggregate([
                    {
                        $unwind: "$menuItemIds",
                    },
                    {
                        $addFields: {
                            menuItemObjectId: { $toObjectId: "$menuItemIds" },
                        },
                    },
                    {
                        $lookup: {
                            from: "menu",
                            localField: "menuItemObjectId",
                            foreignField: "_id",
                            as: "menuItems",
                        },
                    },
                    {
                        $unwind: "$menuItems",
                    },
                    {
                        $group: {
                            _id: '$menuItems.category',
                            quantity: { $sum: 1 },
                            revenue: { $sum: '$menuItems.price' },

                        }
                    },
                    //_id er jaigai category name change below code
                    {
                        $project: {
                            _id: 0, //er mane id jabe na
                            category: '$_id', // category name sokol id chole jabe
                            quantity: '$quantity',
                            revenue: '$revenue',

                        }
                    },

                ])

                .toArray();
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