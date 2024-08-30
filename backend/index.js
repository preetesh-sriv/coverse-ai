import express from 'express'
import cors from 'cors';
import ImageKit from "imagekit";
import mongoose from 'mongoose';
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node'
import chat from './models/chat.js';
import UserChats from './models/userChats.js';

const port = process.env.PORT || 3000;
const app = express();

app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials:true,
}))

app.use(express.json())

const connect = async()=>{
    try {
        await mongoose.connect(process.env.MONGO)
        console.log('Connected to Mongodb')
    } catch (err) {
        console.log(err)
    }
}

const imagekit = new ImageKit({
    // this is a instance
    urlEndpoint: process.env.IMAGE_KIT_ENDPOINT,
    publicKey: process.env.IMAGE_KIT_PUBLIC_KEY,
    privateKey: process.env.IMAGE_KIT_PRIVATE_KEY,
  });

app.get('/api/upload',(req,res)=>{
    const result = imagekit.getAuthenticationParameters();
    res.send(result);
})

// app.get('/api/test',ClerkExpressRequireAuth(),(req,res)=>{
// const userId = req.auth.userId;
//     console.log(userId);
//     res.send('Success!')
// })

app.post('/api/chats',ClerkExpressRequireAuth(),async (req,res)=>{
    const userId = req.auth.userId;
    const {text} = req.body;
    // console.log(text);

    try {
        // create new chat 
        const newChat = new chat({
            userId:userId,
            history:[{role:'user',parts:[{text}]}]
        })
        const savedChat = await newChat.save();

        // check if te user chats exist
        const userChats = await UserChats.find({userId:userId});
        // if does not exist , create a new one and add the chat in the chat array 
        if(!userChats.length){
            const newUserChats = new UserChats({
                userId:userId,
                chats:[
                    {
                        _id: savedChat.id,
                        title: text.substring(0.40),
                    }
                ]
            })
            await newUserChats.save()
        }else{
        //   if exists , push the chat to the existing array 
            await UserChats.updateOne({userId:userId},{
                $push:{
                    chats:{
                        _id: savedChat._id,
                        title:text.substring(0,40),
                    }
                }
            })
            res.status(201).send(newChat._id);
        }  
    } catch (err) {
        console.log(err)
        res.status(500).send("Error creating chat!")
    }
})

app.get('/api/userchats',ClerkExpressRequireAuth(),async(req,res)=>{
    const userId = req.auth.userId;
    try {
        const userChats = await UserChats.find({userId});
        res.status(200).send(userChats[0].chats);
    } catch (err) {
        console.log(err)
        res.status(500).send('Error fetching userchats!');
    }
})

app.get('/api/chats/:id',ClerkExpressRequireAuth(),async(req,res)=>{
    const userId = req.auth.userId;
    try {
        const Chat = await chat.findOne({_id:req.params.id,userId});
        res.status(200).send(Chat);
    } catch (err) {
        console.log(err)
        res.status(500).send('Error fetching chat!');
    }
})

app.put('/api/chats/:id',ClerkExpressRequireAuth(),async(req,res)=>{
    const userId = req.auth.userId;
    const {question,answer,img} = req.body;
    const newItems = [
     ...(question 
        ? [{role:'user',parts:[{text:question}],...(img && {img})}]
         :[]),
        {role:'model',parts:[{text:answer}]},
    ]
    try {
        const updatedChat = await chat.updateOne({_id:req.params.id,userId},{
            $push:{
                history:{
                  $each: newItems,
                }
            }
        });
        res.status(200).send();
    } catch (error) {
        console.log(err);
        res.status(500).send('Error adding conversation')
    }
})

app.use((err, req, res, next) => {
    // to handle authentication error 
    console.error(err.stack)
    res.status(401).send('Unauthenticated!')
  })

app.listen(port,()=>{
    connect()
    console.log("Server running on 3000")
})