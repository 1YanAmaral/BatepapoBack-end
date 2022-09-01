import express from "express";
import cors from "cors";
import Joi from "joi";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

const app = express();
app.use(cors());
app.use(express.json());
dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(() => {
  db = mongoClient.db("bpuol");
});

app.post("/participants", (req, res) => {
  const { name } = req.body;

  const schema = Joi.object({
    name: Joi.string().required(),
    lastStatus: Joi.number(),
  });

  const newParticipant = {
    name,
    lastStatus: Date.now(),
  };
  const { error, value } = schema.validate(newParticipant);
  if (error) {
    res.sendStatus(422);
    return;
  }

  participants.push(newParticipant);
  res.status(201).send(participants);
});

app.listen(5000, () => console.log("Listening on 5000"));
