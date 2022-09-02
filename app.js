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
    const repeatedName = await db
      .collection("participants")
      .find({ name: newParticipant.name })
      .toArray();
    if (repeatedName.length !== 0) {
      res.status(409).send("Nome já em uso");
      return;
    }
    await db.collection("participants").insertOne(newParticipant);
    const newLogin = {
      from: newParticipant.name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
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

app.get("/participants", async (req, res) => {
  try {
    const allParticipants = await db
      .collection("participants")
      .find()
      .toArray();
    res.send(allParticipants);
  } catch (error) {
    (err) => {
      console.error(err);
      res.sendStatus(500);
    };
  }
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const from = req.headers.user;

  const schema = Joi.object({
    to: Joi.string().required(),
    text: Joi.string().required(),
    type: Joi.string().required().valid("message").valid("private_message"),
    from: Joi.string().required(),
  });
  try {
    const newMessage = await schema.validateAsync({ to, text, type, from });
    const loggedParticipants = await db
      .collection("participants")
      .find({ name: from })
      .toArray();
    if (loggedParticipants.length === 0) {
      res.status(422).send("Usuário não logado");
      console.log(loggedParticipants);
      return;
    }
    await db
      .collection("messages")
      .insertOne({ ...newMessage, time: dayjs().format("HH:mm:ss") });
    res.sendStatus(201);
  } catch (error) {
    (err) => {
      console.error(err);
      res.sendStatus(500);
    };
  }
});

app.get("/messages", async (req, res) => {
  const limit = parseInt(req.query.limit);
  const user = req.headers.user;
  console.log(user);
  const allMessages = await db.collection("messages").find().toArray();
  try {
    const messages = allMessages.filter(
      (message) =>
        (message.type === "private_message" && message.from === user) ||
        (message.type === "private_message" && message.to === user) ||
        message.type === "message"
    );
    if (limit) {
      res.send(messages.splice(-limit));
      return;
    }
    res.send(messages);
  } catch (error) {
    (err) => {
      console.error(err);
      res.sendStatus(500);
    };
  }
});

app.post("/status", async (req, res) => {
  const user = req.headers.user;
  try {
    const allUsers = await db.collection("participants").find().toArray();
    const loggedUser = allUsers.find((users) => users.name === user);
    if (!loggedUser) {
      res.sendStatus(404);
      return;
    }
    await db
      .collection("participants")
      .updateOne(loggedUser, { $set: { lastStatus: Date.now() } });
    res.sendStatus(200);
  } catch (error) {
    (err) => {
      console.error(err);
      res.sendStatus(500);
    };
  }
});

app.listen(5000, () => console.log("Listening on 5000"));
