import express from "express";
import cors from "cors";
import Joi from "joi";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";

const app = express();
app.use(cors());
app.use(express.json());
dotenv.config();

const now = dayjs().format("HH:mm:ss");

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(() => {
  db = mongoClient.db("bpuol");
});

app.post("/participants", async (req, res) => {
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
  try {
    await db.collection("participants").insertOne(newParticipant);
    const newLogin = {
      from: newParticipant.name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: now,
    };
    await db.collection("login_messages").insertOne(newLogin);
    res.sendStatus(201);
  } catch (error) {
    (err) => {
      console.error(err);
      res.sendStatus(500);
    };
  }
});

app.listen(5000, () => console.log("Listening on 5000"));
