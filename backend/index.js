const express = require('express');
const connectMongo = require('./db');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');

connectMongo();

const app = express();
app.use(express.json());
app.set("view engine", "ejs");
app.set("views", path.resolve("./views"));
app.use(cookieParser());
app.use(cors());

app.get('/', (req, res) => {
    res.render('signup');
})

app.use('/auth', require('./routes/auth'));
app.listen(5000, () => {
    console.log('http://localhost:5000/');
})