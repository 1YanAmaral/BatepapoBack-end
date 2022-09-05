import express from "express";
import cors from "cors";
import Joi from "joi";
import { MongoClient, ObjectId } from "mongodb";
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
    await db.collection("messages").insertOne(newLogin);
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

  const allMessages = await db.collection("messages").find().toArray();
  try {
    const messages = allMessages.filter(
      (message) =>
        (message.type === "private_message" && message.from === user) ||
        (message.type === "private_message" && message.to === user) ||
        message.type === "message" ||
        message.type === "status"
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
    const loggedUser = await db
      .collection("participants")
      .findOne({ name: user });
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

async function removeInactive() {
  try {
    const users = await db.collection("participants").find().toArray();
    users.forEach(async (user) => {
      if (Date.now() - parseInt(user.lastStatus) > 10000) {
        await db.collection("participants").deleteOne(user);
        await db.collection("messages").insertOne({
          from: user.name,
          to: "Todos",
          text: "sai da sala...",
          type: "status",
          time: dayjs().format("HH:mm:ss"),
        });
      }
    });
  } catch (error) {}
}
setInterval(removeInactive, 15000);

app.delete("/messages/:messageId", async (req, res) => {
  const { messageId } = req.params;
  const { user } = req.headers;
  console.log(user);
  try {
    const message = await db
      .collection("messages")
      .findOne({ _id: ObjectId(messageId) });

    if (!message) {
      res.sendStatus(404);
      return;
    }
    if (message.from !== user) {
      res.sendStatus(401);
      return;
    }
    await db.collection("messages").deleteOne({ _id: ObjectId(messageId) });

    res.sendStatus(200);
  } catch (error) {
    (err) => {
      console.error(err);
      res.sendStatus(500);
    };
  }
});

app.put("/messages/:messageId", async (req, res) => {
  const { to, text, type } = req.body;
  const from = req.headers.user;
  const { messageId } = req.params;

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
      return;
    }

    const message = await db
      .collection("messages")
      .findOne({ _id: ObjectId(messageId) });
    if (!message) {
      res.sendStatus(404);
      return;
    }
    if (from !== message.from) {
      res.sendStatus(401);
      return;
    }

    await db
      .collection("messages")
      .updateOne({ _id: ObjectId(messageId) }, { $set: newMessage });
  } catch (error) {}
});

app.listen(5000, () => console.log("Listening on 5000"));
