import express from "express";
import cors from "cors";
import Joi from "joi";

const app = express();
app.use(cors());
app.use(express.json());

const participants = [];

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
