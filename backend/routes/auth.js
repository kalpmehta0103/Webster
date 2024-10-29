require('dotenv').config();
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const session = require('express-session');
const googleOAuth = require('passport-google-oauth2');
const findOrCreate = require('mongoose-findorcreate');
const passportLocalMongoose = require('passport-local-mongoose');
const crypto = require('crypto');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

const Token = require('../models/Token');
const User = require('../models/User');
const upload = require('../middleware/multer-config');
const sendEmail = require('../middleware/sendEmail');
const configCloudinary = require('../utils/cloudinary-config');

configCloudinary();

//route-1: Signup
router.post('/signup', upload.single('profilePicture'),  async(req, res) => {
    let success = false;
    
    
    const {email, password, name, regNo, number, branch, year} = req.body;
    const uploadResult = await cloudinary.uploader
        .upload(
            req.file.path, {
                folder: 'webster',
                public_id: 'websterProfile' + req.file.originalname,
            }
        )
        .catch((error) => {
            console.log(error);
        });
    
    let user = await User.findOne({email: email});
    if(user) {
        res.status(400).json({message: "User already exist"});
    } 
    console.log(password);
    
    const salt = await bcrypt.genSalt(10);
    const securedPassword = await bcrypt.hash(password, salt);
    console.log(typeof(uploadResult.secure_url) + " " + uploadResult.secure_url);
    
    
    user = await new User({
        email: email,
        password: securedPassword,
        name: name,
        regNo: regNo,
        number: number,
        branch: branch,
        year: year,
        profilePicture: uploadResult.secure_url
    }).save();
    fs.unlink((req.file.path), (err) => {
        if(err) console.log(err);
        else console.log("Deleted File");
    })
    console.log(user.profilePicture);
    const data = {
        user: {
            id: user.id
        }
    }
    const token = await new Token({
        userId: user._id,
        token: crypto.randomBytes(32).toString("hex")
    }).save();
    const url = `http://localhost:5000/auth/${user._id}/verify/${token.token}`;
    await sendEmail(user.email, "Verify Email", url);

    const authToken = jwt.sign(data, process.env.JWT_SECRET);
    success = true;
    res.json({success, authToken, user});
});

// route-2: login
router.post('/login', async (req, res) => {
    let success = false;
    const { email, password } = req.body;

    try {
        let user = await User.findOne({ email: email });
        if(!user) {
            res.status(400).json({message: "No user found"})
        }
        const passwordCompare = await bcrypt.compare(password, user.password);
        if(!passwordCompare) {
            res.status(400).json({message: "Please enter correct password"});
        }
        
        const data = {
            user: {
                id: user.id
            }
        }
        
        if(!user.isVerified) {
            // console.log();
            let token = await Token.findOne({userId: user._id});
            if(!token) {
                token = await new Token({
                    userId: user._id,
                    token: crypto.randomBytes(32).toString('hex')
                }).save();
            }
            
            const url = `http://localhost:5000/auth/${user._id}/verify/${token.token}`;
            await sendEmail(user.email,"Verify Email",url)
        
            res.status(201).json({message:"Email has been sent"});
        } else {
            const authToken = jwt.sign(data, process.env.JWT_SECRET);
            success = true
            res.status(201).json({success, authToken, user});
        }
    } catch (error) {
        console.log(error.message);
        res.status(500).json({message: "Internal Server Error"})
    }
});

//route-3: email verification
router.get("/:id/verify/:token", async (req, res) => {
    try {
        const user = await User.findOne({_id: req.params.id});
        if(!user) {
            res.status(400).json({message: "No User Found"});
        }
        const token = await Token.findOne({
            userId: user._id,
            token: req.params.token
        })
        if(!token) {
            res.status(400).json({message: "Invalid link"});
        }
        await User.updateOne({_id: user._id}, {$set: {isVerified: true}});
        await Token.deleteOne({userId: user._id});
        res.status(200).json({message: "Email Verified"})
    } catch(error) {
        res.status(500).json({message: "Email Not verified " + error});
    }
});

module.exports = router;